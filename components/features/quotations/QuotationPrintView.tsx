'use client'

/**
 * Documento comercial da cotação (A4, multi-página) — gerado via
 * window.print() (sem headless-Chrome/puppeteer: o navegador do usuário é
 * o motor de PDF). Reaproveita 100% os dados já existentes em
 * travel_proposals/quotation_products (ver actions/quotations.ts,
 * getQuotationFull) — nenhum campo novo foi criado no banco.
 *
 * Arquitetura: DATA (props) → normalização por tipo → registry
 * product_type → card component → layout do documento → paginação via CSS
 * (break-inside: avoid em cada card, sem scaling/compactação artificial —
 * ao contrário da versão anterior deste componente, este documento CRESCE
 * verticalmente por quantas páginas forem necessárias; nunca corta ou
 * encolhe conteúdo pra caber em 1 página).
 *
 * Regra absoluta de precificação: o único valor monetário exibido no
 * documento é quotation.total_cents (box "Total da viagem"). Nenhum card
 * de produto mostra preço individual, subtotal ou taxa — mesmo quando o
 * produto tem price_cents/cabin_options com valor próprio no banco (usado
 * só internamente/no editor). Ver PRODUCT_REGISTRY abaixo.
 *
 * QR Code de pagamento: o modelo atual de cotação não tem link/pagamento
 * online por cotação (não existe integração Asaas nesse nível) — o prop
 * `payment` é opcional e, ausente/disabled, simplesmente não renderiza o
 * QR (o header se reorganiza sozinho por ser flex). Fica pronto pra plugar
 * quando essa feature existir, sem precisar mexer no layout de novo.
 */

import { useMemo, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Printer, ArrowLeft, Check, X, Phone, Mail, Clock,
  Plane, Building2, Car, Shield, Ship, Package, User, Ticket, KeyRound, ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BAGGAGE_OPTIONS, CABIN_LABELS } from './PublicQuotationView'

/* ───────────────────────── tipos ───────────────────────── */

type OrgBranding = {
  name: string
  logo_url: string | null
  primary_color: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  website: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
}

type Seller = { name: string; email?: string | null; phone?: string | null } | null

type Payment = { enabled: boolean; url?: string | null; qr_code?: string | null } | null

/** Produto genérico como vem de quotation_products — cada tipo lê de
 *  `data` os campos que interessam (ver PRODUCT_REGISTRY). */
type Product = {
  id: string
  type: string
  name: string | null
  summary: string | null
  date_start: string | null
  date_end: string | null
  data: Record<string, any>
}

type Quotation = {
  id: string
  title: string | null
  client_name: string | null
  destinations: { name: string; country?: string | null }[] | null
  start_date: string | null
  end_date: string | null
  pax_adults: number | null
  pax_children: number | null
  total_cents: number | null
  payment_conditions: { label: string; value?: string | null }[] | null
  price_disclaimer: string | null
  included: string[] | null
  not_included: string[] | null
  cancellation_html: string | null
  important_html?: string | null
  flights_html: string | null
  flight_fare_conditions?: string[] | null
  created_at?: string | null
}

/* ───────────────────────── helpers ───────────────────────── */

function fmtDate(d?: string | null) {
  if (!d) return null
  const datePart = d.slice(0, 10)
  const dt = new Date(datePart + 'T12:00:00')
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('pt-BR')
}
function fmtCurrency(cents: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}
/** "20 de agosto de 2026" — data por extenso, usada na frase "Esta cotação
 *  foi realizada no dia…" abaixo do título. */
function fmtDateExtenso(d?: string | null): string | null {
  if (!d) return null
  const dt = new Date(d.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}
/** (dd) xxxxx-xxxx — extrai só os dígitos e formata; se não tiver DDD (10/11
 *  dígitos) retorna o texto original sem tentar adivinhar. */
function fmtPhone(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}
/** 99999-999 — cep já vem só com dígitos ou já formatado do cadastro da
 *  agência; normaliza pros dois casos. */
function fmtCep(cep?: string | null): string | null {
  if (!cep) return null
  const digits = cep.replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep
}
const FARE_CONDITION_LABELS: Record<string, string> = {
  nao_reembolsavel: 'Não reembolsável',
  alteracao_com_custo: 'Permite alteração com custo',
  nao_permite_alteracao: 'Não permite alteração',
}
function stripHtml(html?: string | null) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
function hasHtml(html?: string | null): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim() !== '' || /<img/i.test(html)
}
function nightsBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null
  const d1 = new Date(a.slice(0, 10) + 'T12:00:00')
  const d2 = new Date(b.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null
  const n = Math.round((d2.getTime() - d1.getTime()) / 86400000)
  return n > 0 ? n : null
}

function Rich({ html, className, onReady }: { html?: string | null; className?: string; onReady?: () => void }) {
  const [clean, setClean] = useState('')
  useEffect(() => {
    let on = true
    if (!html) { setClean(''); onReady?.(); return }
    import('dompurify').then(m => { if (on) { setClean(m.default.sanitize(html)); onReady?.() } })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])
  if (!clean) return null
  // eslint-disable-next-line react/no-danger
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}

/** Label pequeno + valor — bloco de "info field" reutilizado nos grids de
 *  cada card (check-in/check-out, quarto/regime, etc). Some sozinho se o
 *  valor não existir, em vez de mostrar "—"/undefined. */
function InfoField({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="min-w-0">
      <p className="text-[6.5pt] uppercase tracking-wide text-[#777]">{label}</p>
      <p className="text-[8.5pt] font-semibold text-[#111] truncate">{value}</p>
    </div>
  )
}

/* ─────────────── header de cada Product Card ─────────────── */

function CardHeader({ icon: Icon, title, right }: { icon: any; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-[2.5mm] mb-[2.5mm] border-b-[0.6pt] border-[#D0D0D0]">
      <div className="flex items-center gap-[1.8mm] min-w-0">
        <Icon className="w-[3.6mm] h-[3.6mm] text-[#172A9B] shrink-0" strokeWidth={2} />
        <p className="text-[13pt] font-bold text-[#111] truncate">{title}</p>
      </div>
      {right && <p className="text-[7pt] text-[#555] shrink-0">{right}</p>}
    </div>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="avoid-break border-[0.8pt] border-[#C8C8C8] rounded-[4mm] bg-white p-[4mm] mb-[5mm]">
      {children}
    </div>
  )
}

/* ───────────────────────── Flight card ───────────────────────── */

type FlightLeg = Record<string, any>

function FlightCard({ legs, fareConditions }: { legs: FlightLeg[]; fareConditions: string[] }) {
  const idas = legs.filter(f => f.leg_type === 'outbound')
  const voltas = legs.filter(f => f.leg_type === 'inbound')
  const conexoes = legs.filter(f => f.leg_type === 'connection')
  const groups = [
    { label: 'Ida', legs: idas }, { label: 'Volta', legs: voltas }, { label: 'Conexão', legs: conexoes },
  ].filter(g => g.legs.length > 0)

  const route = [legs[0]?.from_city || legs[0]?.from_code, legs[legs.length - 1]?.to_city || legs[legs.length - 1]?.to_code]
    .filter(Boolean).join(' — ')

  const allBaggage = Array.from(new Set(legs.flatMap(f => (f.baggage || []) as string[])))

  return (
    <CardShell>
      <CardHeader icon={Plane} title="Aéreo" right={fareConditions.length > 0 && (
        <span className="flex flex-wrap justify-end gap-[1mm]">
          {fareConditions.map(fc => (
            <span key={fc} className="text-[6.5pt] text-[#555] border-[0.6pt] border-[#D0D0D0] rounded-full px-[2mm] py-[0.5mm] whitespace-nowrap">{FARE_CONDITION_LABELS[fc] || fc}</span>
          ))}
        </span>
      )} />
      {route && <p className="text-[11pt] font-bold text-[#111] mb-[2.5mm]">{route}</p>}

      {groups.map(group => (
        <div key={group.label} className="mb-[3mm] last:mb-0">
          {group.legs.map((f, i) => {
            const bag = BAGGAGE_OPTIONS.filter(b => (f.baggage || []).includes(b.key)).map(b => b.short).join(' · ')
            const cabin = f.cabin_class ? CABIN_LABELS[f.cabin_class] || f.cabin_class : ''
            return (
              <div key={i} className="mb-[2mm] last:mb-0">
                <p className="text-[8pt] font-semibold text-[#555] mb-[1mm]">
                  {group.label} {[f.from_city || f.from_code, f.to_city || f.to_code].filter(Boolean).join(' — ')}
                </p>
                <div className="flex items-center gap-[2mm]">
                  <div className="flex-1 min-w-0">
                    {(f.date || f.departure_time) && (
                      <p className="text-[11pt] font-bold text-[#111]">
                        {f.departure_time || ''} {f.from_code || ''}
                        {fmtDate(f.date) && <span className="text-[7pt] font-normal text-[#777]"> · {fmtDate(f.date)}</span>}
                      </p>
                    )}
                    <p className="text-[7pt] text-[#777]">{f.from_city || ''}</p>
                  </div>
                  <div className="flex flex-col items-center px-[2mm] shrink-0">
                    {f.duration_label && <p className="text-[7pt] text-[#555]">{f.duration_label}</p>}
                    <div className="w-[16mm] h-[0.6pt] bg-[#D0D0D0] my-[0.8mm]" />
                    {(f.airline || f.flight_number) && (
                      <p className="text-[6.5pt] text-[#777]">{[f.airline, f.flight_number].filter(Boolean).join(' ')}</p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    {(f.arrival_date || f.arrival_time) && (
                      <p className="text-[11pt] font-bold text-[#111]">
                        {fmtDate(f.arrival_date || f.date) && <span className="text-[7pt] font-normal text-[#777]">{fmtDate(f.arrival_date || f.date)} · </span>}
                        {f.arrival_time || ''} {f.to_code || ''}
                      </p>
                    )}
                    <p className="text-[7pt] text-[#777]">{f.to_city || ''}</p>
                  </div>
                </div>
                {cabin && <p className="text-[7pt] text-[#555] mt-[1mm]">{cabin}</p>}
                {f.stopover_label && (
                  <div className="flex items-center gap-[1.5mm] bg-[#F7F7F7] border-[0.6pt] border-[#D0D0D0] rounded-[2mm] px-[3mm] py-[1.5mm] mt-[1.5mm]">
                    <Clock className="w-[3mm] h-[3mm] text-[#555] shrink-0" />
                    <p className="text-[7pt] text-[#555]">{f.stopover_label}</p>
                  </div>
                )}
                {bag && <p className="text-[6.5pt] text-[#777] mt-[1mm]">{bag}</p>}
              </div>
            )
          })}
        </div>
      ))}

      {allBaggage.length > 0 && (
        <div className="pt-[2mm] mt-[1mm] border-t-[0.6pt] border-[#D0D0D0]">
          <p className="text-[7.5pt] font-bold text-[#16845B] mb-[1mm]">
            Inclui {BAGGAGE_OPTIONS.filter(b => allBaggage.includes(b.key)).map(b => b.label.toLowerCase()).join(', ')}
          </p>
        </div>
      )}
    </CardShell>
  )
}

function FlightsTextCard({ text }: { text: string }) {
  return (
    <CardShell>
      <CardHeader icon={Plane} title="Aéreo" />
      <p className="text-[8pt] whitespace-pre-wrap text-[#111]">{text}</p>
    </CardShell>
  )
}

/* ───────────────────────── Hotel card ───────────────────────── */

function HotelCard({ p }: { p: Product }) {
  const d = p.data
  const nights = nightsBetween(p.date_start, p.date_end)
  const address = d.tripadvisor_data?.address as string | undefined
  return (
    <CardShell>
      <CardHeader icon={Building2} title="Hospedagem" />
      <div className="flex items-center gap-[1.5mm] mb-[1mm]">
        <p className="text-[11pt] font-bold text-[#111]">{p.name || 'Hospedagem'}</p>
        {d.star_rating > 0 && <span className="text-[8pt] text-[#C9A227]">{'★'.repeat(d.star_rating)}</span>}
      </div>
      {address && <p className="text-[7pt] text-[#777] mb-[2mm]">{address}</p>}
      <div className="grid grid-cols-4 gap-x-[3mm] gap-y-[2mm] mb-[2mm]">
        <InfoField label="Check-in" value={fmtDate(p.date_start)} />
        <InfoField label="Horário" value={d.check_in_time} />
        <InfoField label="Check-out" value={fmtDate(p.date_end)} />
        <InfoField label="Horário" value={d.check_out_time} />
      </div>
      <div className="grid grid-cols-3 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Noites" value={nights ? `${nights} noite${nights === 1 ? '' : 's'}` : null} />
        <InfoField label="Quarto" value={d.room_category} />
        <InfoField label="Regime" value={d.board} />
      </div>
      {hasHtml(d.description_html) && (
        <Rich html={d.description_html} className="text-[7.5pt] leading-snug text-[#555] mt-[2mm] pt-[2mm] border-t-[0.6pt] border-[#D0D0D0] [&_p]:mb-[1mm]" />
      )}
    </CardShell>
  )
}

/* ───────────────────────── Cruise card ───────────────────────── */

function CruiseCard({ p }: { p: Product }) {
  const d = p.data
  const baseCabinLabel = [d.cabin_category, d.cabin_type].filter(Boolean).join(' — ') || null
  const cabinOptions: { label: string; deck?: string | null; location?: string | null; view?: string | null; price_cents?: number | null }[] = d.cabin_options || []
  const paxLine = d.pax_adults
    ? `${d.pax_adults} adulto${d.pax_adults === 1 ? '' : 's'}${d.pax_children ? ` · ${d.pax_children} criança${d.pax_children === 1 ? '' : 's'}` : ''}`
    : null
  const packageParts = [
    d.pkg_drinks && `(Pacote de bebidas) ${d.pkg_drinks}`,
    d.pkg_internet && `(Internet) ${d.pkg_internet}`,
    d.pkg_restaurants && `(Restaurantes) ${d.pkg_restaurants}`,
    d.pkg_gratuities && `(Taxas de serviço) ${d.pkg_gratuities}`,
    d.pkg_others && `(Outros) ${d.pkg_others}`,
  ].filter(Boolean)
  return (
    <CardShell>
      <CardHeader icon={Ship} title="Cruzeiro" />
      <p className="text-[11pt] font-bold text-[#111] mb-[1mm]">{p.name || d.ship_name || d.cruise_line || 'Cruzeiro'}</p>
      {d.itinerary_name && <p className="text-[8pt] text-[#555] mb-[2.5mm]">{d.itinerary_name}</p>}
      <div className="grid grid-cols-3 gap-x-[3mm] gap-y-[2mm] mb-[2mm]">
        <InfoField label="Embarque" value={[d.embark_port, fmtDate(d.embark_date)].filter(Boolean).join(' — ') || null} />
        <InfoField label="Desembarque" value={[d.disembark_port, fmtDate(d.disembark_date)].filter(Boolean).join(' — ') || null} />
        <InfoField label="Noites" value={d.duration_nights ? `${d.duration_nights} noites` : null} />
      </div>
      <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Cabine" value={baseCabinLabel} />
        <InfoField label="Passageiros" value={paxLine} />
      </div>

      {cabinOptions.length > 0 && (
        <div className="mt-[2.5mm]">
          <p className="text-[6.5pt] text-[#777] mb-[1.5mm]">
            Preço com base na cabine {baseCabinLabel || 'mais econômica'} — confira as opções de upgrade abaixo.
          </p>
          {cabinOptions.filter(o => o.label).map((o, i) => (
            <div key={i} className="flex items-center gap-[1.5mm] bg-[#F7F7F7] border-[0.6pt] border-[#D0D0D0] rounded-[2mm] px-[3mm] py-[1.5mm] mb-[1mm] last:mb-0">
              <ArrowUpRight className="w-[3mm] h-[3mm] text-[#555] shrink-0" />
              <p className="text-[7pt] text-[#555]">
                <span className="font-semibold text-[#111]">{o.label}</span>
                {[o.deck && `Deck ${o.deck}`, o.location, o.view].filter(Boolean).length > 0
                  ? ` — ${[o.deck && `Deck ${o.deck}`, o.location, o.view].filter(Boolean).join(' · ')}` : ''}
                {o.price_cents ? ` — upgrade ${fmtCurrency(o.price_cents)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {d.pkg_drinks_upgrade_cents > 0 && (
        <div className="flex items-center gap-[1.5mm] bg-[#F7F7F7] border-[0.6pt] border-[#D0D0D0] rounded-[2mm] px-[3mm] py-[1.5mm] mt-[1mm]">
          <ArrowUpRight className="w-[3mm] h-[3mm] text-[#555] shrink-0" />
          <p className="text-[7pt] text-[#555]">
            <span className="font-semibold text-[#111]">Pacote de bebidas superior</span> — upgrade {fmtCurrency(d.pkg_drinks_upgrade_cents)}
          </p>
        </div>
      )}

      {packageParts.length > 0 && (
        <p className="text-[7pt] text-[#777] mt-[2mm] pt-[2mm] border-t-[0.6pt] border-[#D0D0D0]">
          {packageParts.join(' · ')}
        </p>
      )}
    </CardShell>
  )
}

/* ───────────────────────── Transfer / Seguro / genérico ───────────────────────── */

function TransferCard({ p }: { p: Product }) {
  const d = p.data
  return (
    <CardShell>
      <CardHeader icon={Car} title="Transfer" />
      {p.name && <p className="text-[11pt] font-bold text-[#111] mb-[2.5mm]">{p.name}</p>}
      <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Origem" value={d.origin} />
        <InfoField label="Destino" value={d.destination} />
        <InfoField label="Data" value={fmtDate(p.date_start)} />
        <InfoField label="Horário" value={d.time} />
        <InfoField label="Veículo" value={d.vehicle} />
        <InfoField label="Passageiros" value={d.pax} />
        <InfoField label="Tipo" value={d.transfer_type} />
      </div>
      {p.summary && <p className="text-[7.5pt] text-[#777] mt-[2mm]">{p.summary}</p>}
    </CardShell>
  )
}

function InsuranceCard({ p }: { p: Product }) {
  const d = p.data
  return (
    <CardShell>
      <CardHeader icon={Shield} title="Seguro viagem" />
      {(d.insurer || p.name) && <p className="text-[11pt] font-bold text-[#111] mb-[2.5mm]">{d.insurer || p.name}</p>}
      <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Plano" value={d.plan} />
        <InfoField label="Destino" value={d.destination} />
        <InfoField label="Período" value={p.date_start ? `${fmtDate(p.date_start)} a ${fmtDate(p.date_end)}` : null} />
        <InfoField label="Viajantes" value={d.travelers} />
      </div>
      {d.coverage && <p className="text-[7.5pt] text-[#777] mt-[2mm]">{d.coverage}</p>}
    </CardShell>
  )
}

function TourCard({ p }: { p: Product }) {
  const d = p.data
  return (
    <CardShell>
      <CardHeader icon={Ticket} title="Passeio" />
      {p.name && <p className="text-[11pt] font-bold text-[#111] mb-[1mm]">{p.name}</p>}
      {p.summary && <p className="text-[8pt] text-[#555] mb-[2mm]">{p.summary}</p>}
      <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Data" value={fmtDate(p.date_start)} />
        <InfoField label="Duração" value={d.duration_label} />
      </div>
      {d.includes && <p className="text-[7.5pt] text-[#777] mt-[2mm]">Inclui: {d.includes}</p>}
    </CardShell>
  )
}

function RentalCard({ p }: { p: Product }) {
  const d = p.data
  return (
    <CardShell>
      <CardHeader icon={KeyRound} title="Locação de veículo" />
      {(d.company || p.name) && <p className="text-[11pt] font-bold text-[#111] mb-[2.5mm]">{[d.company, d.vehicle_category].filter(Boolean).join(' — ') || p.name}</p>}
      <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Retirada" value={d.pickup_location} />
        <InfoField label="Devolução" value={d.dropoff_location} />
        <InfoField label="Data de retirada" value={fmtDate(p.date_start)} />
        <InfoField label="Data de devolução" value={fmtDate(p.date_end)} />
      </div>
      {d.notes && (
        <p className="text-[9pt] text-[#555] mt-[3mm] whitespace-pre-wrap leading-snug">{d.notes}</p>
      )}
    </CardShell>
  )
}

/** Qualquer tipo futuro sem card dedicado ainda — mostra o que existe
 *  (nome/resumo/datas) sem inventar campos. */
function GenericProductCard({ p, label }: { p: Product; label: string }) {
  return (
    <CardShell>
      <CardHeader icon={Package} title={label} />
      {p.name && <p className="text-[11pt] font-bold text-[#111] mb-[1mm]">{p.name}</p>}
      {p.summary && <p className="text-[8pt] text-[#555] mb-[2mm]">{p.summary}</p>}
      {(p.date_start || p.date_end) && (
        <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
          <InfoField label="Início" value={fmtDate(p.date_start)} />
          <InfoField label="Fim" value={fmtDate(p.date_end)} />
        </div>
      )}
    </CardShell>
  )
}

/* ───────────────────────── registry ───────────────────────── */

const PRODUCT_LABELS: Record<string, string> = {
  aereo: 'Aéreo', hospedagem: 'Hospedagem', cruzeiro: 'Cruzeiro',
  transfer: 'Transfer', seguro: 'Seguro viagem', passeio: 'Passeio', locacao: 'Locação',
}

/* ═══════════════════════════════════════════════════════════════════════
   Documento
   ═══════════════════════════════════════════════════════════════════ */

export default function QuotationPrintView({
  quotation, products, org, seller = null, payment = null,
}: {
  quotation: Quotation
  products: Product[]
  org: OrgBranding
  seller?: Seller
  payment?: Payment
}) {
  const addressLine = [
    org.address_street,
    [org.address_city, org.address_state].filter(Boolean).join(' - '),
    fmtCep(org.address_zip) && `CEP ${fmtCep(org.address_zip)}`,
  ].filter(Boolean).join(' · ') || null

  const destinations = (quotation.destinations || []).map(d => d.name).filter(Boolean).join(', ')
  const paxLine = quotation.pax_adults
    ? `${quotation.pax_adults} adulto${quotation.pax_adults === 1 ? '' : 's'}${quotation.pax_children ? ` e ${quotation.pax_children} criança${quotation.pax_children === 1 ? '' : 's'}` : ''}`
    : ''

  const flightLegs = products.filter(p => p.type === 'aereo').map(p => p.data)
  const flightsHtmlText = stripHtml(quotation.flights_html)
  const fareConditions = quotation.flight_fare_conditions || []

  // Unidades de renderização, na ordem em que os produtos foram salvos —
  // todas as pernas de voo viram UM card único (o card é indivisível: um
  // "Aéreo" com ida/volta/conexão, não um card por perna).
  const renderUnits = useMemo(() => {
    const units: { key: string; node: React.ReactNode }[] = []
    let flightsConsumed = false
    for (const p of products) {
      if (p.type === 'aereo') {
        if (flightsConsumed) continue
        flightsConsumed = true
        units.push({ key: 'flights', node: <FlightCard legs={flightLegs} fareConditions={fareConditions} /> })
        continue
      }
      const label = PRODUCT_LABELS[p.type] || p.type
      let node: React.ReactNode
      switch (p.type) {
        case 'hospedagem': node = <HotelCard p={p} />; break
        case 'cruzeiro': node = <CruiseCard p={p} />; break
        case 'transfer': node = <TransferCard p={p} />; break
        case 'seguro': node = <InsuranceCard p={p} />; break
        case 'passeio': node = <TourCard p={p} />; break
        case 'locacao': node = <RentalCard p={p} />; break
        default: node = <GenericProductCard p={p} label={label} />
      }
      units.push({ key: p.id, node })
    }
    if (!flightsConsumed && flightsHtmlText) {
      units.unshift({ key: 'flights-text', node: <FlightsTextCard text={flightsHtmlText} /> })
    }
    return units
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, flightsHtmlText, paxLine, fareConditions])

  const hasIncludedExcluded = (quotation.included?.length ?? 0) > 0 || (quotation.not_included?.length ?? 0) > 0
  const cancellationHasContent = hasHtml(quotation.cancellation_html)
  const importantHasContent = hasHtml(quotation.important_html)
  const quotedDateExtenso = fmtDateExtenso(quotation.created_at)

  const paymentConditions = (quotation.payment_conditions || []).reduce<{ label: string; value?: string | null }[]>((acc, p) => {
    const dup = acc.find(x => (x.value || '').trim() && x.value === p.value)
    if (dup) { dup.label = `${dup.label} / ${p.label}`; return acc }
    acc.push({ ...p })
    return acc
  }, [])

  const qrVisible = !!payment?.enabled && !!payment?.qr_code

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between">
        <a href="/app" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </a>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-[#111] shadow-sm print:shadow-none doc-page">
        {/* ── Header: logo | agência | vendedor | QR ─────────────── */}
        <div className="flex items-start justify-between gap-[4mm] pb-[4mm] mb-[5mm] border-b-[0.8pt] border-[#BDBDBD] avoid-break">
          {org.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="shrink-0" style={{ maxWidth: '35mm', maxHeight: '28mm', objectFit: 'contain' }} />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[9pt] leading-snug"><span className="font-bold">Agência:</span> <span className="font-bold">{org.name}</span></p>
            {org.contact_phone && <p className="text-[8pt] text-[#555] leading-snug mt-[0.5mm]">{fmtPhone(org.contact_phone)}</p>}
            {org.contact_email && <p className="text-[8pt] text-[#555] leading-snug">{org.contact_email}</p>}
            {org.website && <p className="text-[8pt] text-[#555] leading-snug">{org.website}</p>}
            {addressLine && <p className="text-[8pt] text-[#555] leading-snug mt-[1.5mm]">{addressLine}</p>}
            {org.cnpj && <p className="text-[7pt] text-[#777] leading-snug mt-[0.5mm]">CNPJ {org.cnpj}{org.cadastur ? ` · CADASTUR ${org.cadastur}` : ''}</p>}
          </div>

          {seller && (
            <div className="min-w-0 shrink-0 text-right">
              <p className="text-[9pt] font-bold text-[#111] flex items-center justify-end gap-[1.2mm]"><User className="w-[3mm] h-[3mm] text-[#555]" /> {seller.name}</p>
              {seller.phone && <p className="text-[8pt] text-[#555] flex items-center justify-end gap-[1.2mm]"><Phone className="w-[2.8mm] h-[2.8mm]" /> {seller.phone}</p>}
              {seller.email && <p className="text-[8pt] text-[#555] flex items-center justify-end gap-[1.2mm]"><Mail className="w-[2.8mm] h-[2.8mm]" /> {seller.email}</p>}
            </div>
          )}

          {qrVisible && (
            <div className="shrink-0 text-center">
              <p className="text-[7pt] text-[#555] mb-[1mm] max-w-[25mm]">Leia o QR code e realize o pagamento online</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment!.qr_code!} alt="QR Code de pagamento" style={{ width: '25mm', height: '25mm' }} />
            </div>
          )}
        </div>

        {/* ── Cabeçalho da cotação: título + data + Total ─────────── */}
        <div className="flex items-start justify-between gap-[4mm] mb-[3mm] avoid-break">
          <div className="min-w-0">
            <p className="text-[17pt] font-bold leading-tight" style={{ color: '#172A9B' }}>Orçamento da sua viagem</p>
            {quotedDateExtenso && <p className="text-[8.5pt] text-[#555] mt-[1mm]">Esta cotação foi realizada no dia {quotedDateExtenso}</p>}
          </div>
          <div className="shrink-0 flex items-start gap-[3mm]">
            {paymentConditions.length > 0 && (
              <div className="border-[0.8pt] border-[#C9C9C9] rounded-[5mm] px-[4mm] py-[3.5mm]">
                <p className="text-[7pt] font-bold uppercase tracking-wide text-[#777] mb-[1.5mm]">Forma de pagamento</p>
                <ul className="space-y-[0.5mm]">
                  {paymentConditions.map((p, i) => (
                    <li key={i} className="text-[7.5pt] text-[#555] whitespace-nowrap">• {p.label}{p.value ? ` — ${p.value}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border-[0.8pt] border-[#C9C9C9] rounded-[5mm] px-[5mm] py-[4mm] text-right">
              <p className="text-[7.5pt] uppercase tracking-wide text-[#777] mb-[1mm]">Total da viagem</p>
              <p className="text-[16pt] font-bold text-[#111] tabular-nums">{fmtCurrency(quotation.total_cents)}</p>
              <p className="text-[6.5pt] text-[#777] mt-[0.5mm]">Taxas e impostos incluídos</p>
            </div>
          </div>
        </div>

        {/* ── Cliente / destino / datas / pax + etiquetas de tarifa ── */}
        <div className="mb-[4mm] avoid-break">
          <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[1.5mm]">
            {quotation.client_name && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Nome do Cliente:</span> {quotation.client_name}</p>}
            {destinations && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Destino:</span> {destinations}</p>}
            {fmtDate(quotation.start_date) && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Data de ida:</span> {fmtDate(quotation.start_date)}</p>}
            {fmtDate(quotation.end_date) && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Data de retorno:</span> {fmtDate(quotation.end_date)}</p>}
          </div>
          {paxLine && <p className="text-[7.5pt] text-[#555] mt-[2mm]">{paxLine}</p>}
        </div>

        {/* ── ⚠️ ATENÇÃO — único bloco com vermelho no documento ───── */}
        <div className="border border-red-200 bg-red-50 px-[3mm] py-[2mm] mb-[5mm] avoid-break">
          <p className="text-[7pt] leading-snug text-red-900">
            <span className="font-bold">ATENÇÃO — </span>
            Esta é uma simples cotação. Nenhum dos componentes selecionados está confirmado até que seja efetivada a reserva. Os valores podem sofrer alterações em virtude de disponibilidade e câmbio.
          </p>
        </div>

        {/* ── Product Cards ─────────────────────────────────────── */}
        {renderUnits.map(u => <div key={u.key}>{u.node}</div>)}

        {/* ── Informações importantes ───────────────────────────── */}
        {(importantHasContent || quotation.price_disclaimer) && (
          <div className="mb-[5mm] avoid-break">
            <p className="text-[11pt] font-bold text-[#111] mb-[1.5mm]">Informações importantes</p>
            {importantHasContent && (
              <Rich html={quotation.important_html} className="text-[7pt] leading-snug text-[#555] [&_p]:mb-[1mm] [&_ul]:list-disc [&_ul]:pl-[4mm]" />
            )}
            {quotation.price_disclaimer && (
              <p className="text-[7pt] text-[#555] whitespace-pre-wrap mt-[1mm]">{quotation.price_disclaimer}</p>
            )}
          </div>
        )}

        {/* ── Política de cancelamento ──────────────────────────── */}
        {cancellationHasContent && (
          <div className="mb-[5mm] avoid-break">
            <p className="text-[11pt] font-bold text-[#111] mb-[1.5mm]">Política de cancelamento</p>
            <Rich html={quotation.cancellation_html} className="text-[7.5pt] leading-snug text-[#555] [&_p]:mb-[1mm] [&_ul]:list-disc [&_ul]:pl-[4mm]" />
          </div>
        )}

        {/* ── Inclui / Não inclui — card único, listas horizontais ── */}
        {hasIncludedExcluded && (
          <div className="border-[0.8pt] border-[#D0D0D0] rounded-[4mm] p-[4mm] mb-[5mm] avoid-break">
            {(quotation.included?.length ?? 0) > 0 && (
              <div className={(quotation.not_included?.length ?? 0) > 0 ? 'mb-[2.5mm] pb-[2.5mm] border-b-[0.6pt] border-[#D0D0D0]' : undefined}>
                <p className="text-[9pt] font-bold text-[#111] mb-[1.5mm]">Incluso</p>
                <div className="flex flex-wrap gap-x-[4mm] gap-y-[1mm]">
                  {quotation.included!.map((item, i) => (
                    <span key={i} className="text-[7.5pt] flex items-center gap-[1mm] whitespace-nowrap"><Check className="w-[3mm] h-[3mm] shrink-0 text-[#16845B]" /> {item}</span>
                  ))}
                </div>
              </div>
            )}
            {(quotation.not_included?.length ?? 0) > 0 && (
              <div>
                <p className="text-[9pt] font-bold text-[#111] mb-[1.5mm]">Não incluso</p>
                <div className="flex flex-wrap gap-x-[4mm] gap-y-[1mm]">
                  {quotation.not_included!.map((item, i) => (
                    <span key={i} className="text-[7.5pt] flex items-center gap-[1mm] text-[#555] whitespace-nowrap"><X className="w-[3mm] h-[3mm] shrink-0 text-[#C04A4A]" /> {item}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="pt-[3mm] mt-[3mm] border-t-[0.6pt] border-[#D0D0D0] text-right avoid-break">
          <p className="text-[6pt] text-[#777]">ID da cotação: {quotation.id}</p>
        </div>
      </div>

      <style>{`
        .doc-page {
          width: 210mm;
          font-family: Arial, Helvetica, sans-serif;
          padding: 8mm 10mm;
        }
        @media print {
          /* Margem no @page (não no padding do .doc-page) porque é a única
             forma de aplicar o mesmo respiro em TODAS as páginas físicas —
             um padding no elemento só afeta o topo da primeira página e o
             fim da última quando o conteúdo é paginado pelo navegador. */
          @page { size: A4; margin: 10mm 0; }
          .doc-page { padding: 0 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen {
          .doc-page { margin-bottom: 24px; }
        }
      `}</style>
    </div>
  )
}
