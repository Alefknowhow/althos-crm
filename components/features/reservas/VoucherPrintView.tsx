'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Printer, MapPin, Plane, Hotel, Car, ShieldCheck, ArrowLeft, MessageCircle, Mail,
  Users, CalendarDays, Info, AlertTriangle, Compass, Ticket, Sparkles, Hash, Phone, Globe,
  Backpack, Briefcase, Luggage, Ship,
} from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'

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

type ContatoInfo = { phone: string | null; email: string | null; date_of_birth: string | null } | null

type VooLeg = {
  companhia?: string | null; numero?: string | null; data?: string | null
  origem?: string | null; destino?: string | null; horario?: string | null
  localizador_checkin?: string | null; bilhete?: string | null
  hora_embarque?: string | null; data_chegada?: string | null; hora_chegada?: string | null
  duracao?: string | null; bagagem?: string | null
  escala_local?: string | null; escala_duracao?: string | null
}
type VooProduct = {
  id: string
  data: {
    companhia?: string | null; sentido?: string | null; localizador?: string | null
    bilhete?: string | null; hora_embarque?: string | null; hora_chegada?: string | null
    bagagem?: string | null; origem?: string | null; destino?: string | null
    legs?: VooLeg[]
  }
}
type HospedagemProduct = {
  id: string
  data: {
    hotel?: string | null; localizador?: string | null
    check_in?: string | null; check_out?: string | null
    hora_checkin?: string | null; hora_checkout?: string | null
    tipo_quarto?: string | null; regime?: string | null
    endereco?: string | null; email?: string | null; telefone?: string | null
    titular?: string | null
    informacoes_adicionais?: string | null; politica_cancelamento?: string | null; condicoes?: string | null
  }
}
type GenericProduct = { id: string; kind: string; data: Record<string, any> }

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}

/** Só a primeira palavra do nome da companhia ("LATAM Airlines Group" →
 *  "LATAM") — junto com o número do voo (que já inclui as letras do
 *  código, ex.: "LA3737"), evita que "Companhia / voo" quebre linha na
 *  grade de 4 colunas. */
function firstWord(name?: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null
}

function nights(a?: string | null, b?: string | null) {
  if (!a || !b) return null
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()
  const n = Math.round(ms / 86400000)
  return n > 0 ? n : null
}

// Cabeçalho de seção — barra sólida na cor da marca, ícone + título, no
// mesmo espírito das barras "VOUCHER DE HOTEL / VOUCHER DE VOO" do modelo
// de referência (operadora azul).
function SectionBar({ icon: Icon, title, accent }: { icon: React.ElementType; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-t-md text-white text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: accent }}>
      <Icon className="w-3.5 h-3.5" /> {title}
    </div>
  )
}

/** Interpreta o texto de franquia de bagagem ("Inclui mochila ou bolsa,
 *  Inclui bagagem de mão, Não inclui bagagem para despachar") em 3 flags —
 *  item não mencionado no texto também conta como não incluído (cinza). */
function parseBaggage(text: string): { mochila: boolean; mao: boolean; despachada: boolean } {
  const clauses = text.toLowerCase().split(/[,;]/).map(c => c.trim())
  const flags = { mochila: false, mao: false, despachada: false }
  for (const c of clauses) {
    const negated = /(não|nao)\s+inclui/.test(c)
    if (/mochila|bolsa/.test(c)) flags.mochila = !negated
    if (/m[aã]o/.test(c)) flags.mao = !negated
    if (/despach/.test(c)) flags.despachada = !negated
  }
  return flags
}

function BaggageRow({ text }: { text: string }) {
  const flags = parseBaggage(text)
  const items: { icon: React.ElementType; label: string; included: boolean }[] = [
    { icon: Backpack, label: 'Mochila/bolsa', included: flags.mochila },
    { icon: Briefcase, label: 'Bagagem de mão', included: flags.mao },
    { icon: Luggage, label: 'Bagagem despachada', included: flags.despachada },
  ]
  return (
    <div className="flex items-center gap-4 mt-2 pt-2 border-t flex-wrap">
      {items.map(item => (
        <span key={item.label} className={`flex items-center gap-1 text-[11px] ${item.included ? 'text-emerald-600' : 'text-gray-300'}`}>
          <item.icon className="w-3.5 h-3.5" /> {item.label} — {item.included ? 'incluída' : 'não incluída'}
        </span>
      ))}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  )
}

/** Rótulo + valor num único texto compacto (sem quebra de linha em 2
 *  "andares" como InfoRow) — usado no bloco de resumo/viajantes, que pede
 *  fonte pequena e pouco espaçamento entre os campos. */
function CompactField({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] whitespace-nowrap ${className || ''}`}>
      {label && <span className="text-gray-400 uppercase tracking-wide text-[9px] font-semibold mr-1">{label}</span>}
      <span className="font-medium">{value ?? '—'}</span>
    </span>
  )
}

export default function VoucherPrintView({
  sale, org, contato, voos = [], hospedagens = [], transfers = [], cruzeiros = [], ingressos = [], seguros = [],
}: {
  sale: TravelSaleRow
  org: OrgBranding
  contato?: ContatoInfo
  voos?: VooProduct[]
  hospedagens?: HospedagemProduct[]
  transfers?: GenericProduct[]
  cruzeiros?: GenericProduct[]
  /** Produtos kind='ingresso' ou 'passeio' — mesma seção no voucher. */
  ingressos?: GenericProduct[]
  seguros?: GenericProduct[]
}) {
  const accent = org.primary_color || '#0f62fe'
  const included: string[] = Array.isArray(sale.included_items) ? sale.included_items : []
  const services: string[] = Array.isArray(sale.services) ? sale.services : []
  const all = [...included, ...services]
  const hasVoos = voos.length > 0 || all.includes('voos') || !!sale.airline || !!sale.air_locator
  const hasHotel = hospedagens.length > 0 || all.includes('hospedagem') || !!sale.hotel_name
  const hasTraslado = transfers.length > 0 || all.includes('transfer')
  const hasCruzeiro = cruzeiros.length > 0 || all.includes('cruzeiros')
  const hasPasseios = ingressos.length > 0 || all.includes('passeios') || all.includes('ingressos')
  const hasServicos = all.includes('servicos') || all.includes('carros') || all.includes('car_rental')
  const hasSeguro = seguros.length > 0 || all.includes('seguro') || all.includes('insurance')
  const travelers: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(sale.travelers) ? sale.travelers : []
  const n = nights(sale.departure_date, sale.return_date)

  const qrData = sale.airline_checkin_url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(sale.airline_checkin_url)}`
    : null

  const shareMessage = `Olá ${sale.client_name || ''}! Segue o voucher da sua viagem para ${sale.destination || 'sua viagem'} — anexo o PDF em seguida.`
  const waDigits = contato?.phone ? contato.phone.replace(/\D/g, '') : null
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(shareMessage)}` : null
  const mailUrl = contato?.email
    ? `mailto:${contato.email}?subject=${encodeURIComponent(`Voucher — ${sale.destination || 'sua viagem'}`)}&body=${encodeURIComponent(shareMessage)}`
    : null

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between gap-2 flex-wrap">
        <Link href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" title="Abre o WhatsApp com uma mensagem pronta — anexe o PDF manualmente">
                <MessageCircle className="w-4 h-4 mr-1.5 text-green-600" /> Enviar por WhatsApp
              </Button>
            </a>
          )}
          {mailUrl && (
            <a href={mailUrl}>
              <Button variant="outline" title="Abre seu cliente de e-mail com uma mensagem pronta — anexe o PDF manualmente">
                <Mail className="w-4 h-4 mr-1.5" /> Enviar por e-mail
              </Button>
            </a>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-0 min-h-[297mm]">
        {/* Cabeçalho da agência + caixa de referência */}
        <div className="flex items-start justify-between gap-4 border-b-2 pb-6 mb-6 break-inside-avoid" style={{ borderColor: accent }}>
          <div className="flex items-center gap-3">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-14 w-auto object-contain" />
            )}
            <div>
              <p className="text-lg font-bold">{org.name}</p>
              {(org.cnpj || org.cadastur) && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {org.cnpj && <>CNPJ {org.cnpj}</>}
                  {org.cnpj && org.cadastur && ' · '}
                  {org.cadastur && <>CADASTUR {org.cadastur}</>}
                </p>
              )}
              <div className="mt-1 space-y-0.5">
                {org.contact_phone && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" /> {org.contact_phone}</p>
                )}
                {org.contact_email && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3 shrink-0" /> {org.contact_email}</p>
                )}
                {org.website && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><Globe className="w-3 h-3 shrink-0" /> {org.website}</p>
                )}
              </div>
            </div>
          </div>
          <div className="text-right rounded-md border p-3 min-w-[180px]">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Voucher de viagem</p>
            <p className="text-sm font-mono font-semibold" style={{ color: accent }}>{sale.package_locator || '—'}</p>
            <p className="text-[10px] text-gray-400 mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Resumo (destino/período) + viajantes — bloco único e compacto.
            Titular é a primeira linha da lista de viajantes (mesmo padrão
            das demais), não um campo separado. */}
        <div className="mb-6 border rounded-md overflow-hidden break-inside-avoid">
          <div className="px-3 py-2 space-y-1">
            <div>
              <CompactField label="Destino" value={sale.destination} />
            </div>
            <div>
              <CompactField
                label="Período"
                value={sale.departure_date || sale.return_date ? <>{fmtDate(sale.departure_date)} → {fmtDate(sale.return_date)}{n ? ` (${n} noite${n > 1 ? 's' : ''})` : ''}</> : '—'}
              />
            </div>
          </div>
          {/* Nomes e datas em colunas de verdade (grid único cobrindo todas
              as linhas) — cabeçalho "Nome / Nascimento", titular destacado
              só por um badge, sem repetir rótulo em cada linha. */}
          <div className="grid grid-cols-[40ch_100px_1fr] border-t">
            <div className="px-3 py-1 bg-gray-50 border-b text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Nome</div>
            <div className="px-3 py-1 bg-gray-50 border-b text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Nascimento</div>
            <div className="bg-gray-50 border-b" />

            <div className={`px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 ${travelers.length > 0 ? 'border-b' : ''}`}>
              {sale.client_name || '—'}
              <span
                className="text-[8px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${accent}20`, color: accent }}
              >
                Titular
              </span>
            </div>
            <div className={`px-3 py-1.5 text-[11px] tabular-nums ${travelers.length > 0 ? 'border-b' : ''}`}>
              {contato?.date_of_birth ? fmtDate(contato.date_of_birth) : '—'}
            </div>
            <div className={travelers.length > 0 ? 'border-b' : ''} />

            {travelers.map((t, i) => (
              <Fragment key={i}>
                <div className={`px-3 py-1.5 text-[11px] break-inside-avoid ${i < travelers.length - 1 ? 'border-b' : ''}`}>{t.name}</div>
                <div className={`px-3 py-1.5 text-[11px] tabular-nums ${i < travelers.length - 1 ? 'border-b' : ''}`}>{t.birth_date ? fmtDate(t.birth_date) : '—'}</div>
                <div className={i < travelers.length - 1 ? 'border-b' : ''} />
              </Fragment>
            ))}
          </div>
        </div>

        {/* Seções de serviços — cada bloco só aparece se contratado */}
        <div className="space-y-4 mb-6">
          {hasVoos && (
            <div className="border rounded-md overflow-hidden break-inside-avoid">
              <SectionBar icon={Plane} title="Voos" accent={accent} />
              {sale.air_locator && voos.length === 0 && (
                <div className="px-3 pt-3">
                  <InfoRow label="Localizador (PNR)" value={sale.air_locator} mono />
                </div>
              )}
              {voos.length > 0 ? (
                <div className="divide-y">
                  {voos.map(v => {
                    const legs = v.data.legs && v.data.legs.length > 0 ? v.data.legs : [v.data as VooLeg]
                    // Check-in/bilhete/bagagem valem pro bilhete inteiro (mesmo
                    // valor repetido em cada trecho pelo OCR) — mostra uma vez
                    // só, no cabeçalho do grupo (ida/volta) e no rodapé.
                    const checkin = legs.find(l => l.localizador_checkin)?.localizador_checkin || v.data.localizador
                    const bilhete = legs.find(l => l.bilhete)?.bilhete
                    const bagagem = legs.find(l => l.bagagem)?.bagagem
                    return (
                      <div key={v.id} className="p-3 break-inside-avoid">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-x-4 gap-y-1">
                          <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: accent }}>{v.data.sentido || '—'}</p>
                          <div className="flex items-center gap-4">
                            {checkin && <p className="text-[11px] font-mono text-gray-500">Check-in: {checkin}</p>}
                            {bilhete && <p className="text-[11px] font-mono text-gray-500">Bilhete: {bilhete}</p>}
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {legs.map((leg, i) => (
                            <div key={i} className="break-inside-avoid">
                              {leg.escala_local && (
                                <p className="text-[10px] text-gray-400 italic mb-1.5 text-center">
                                  Conexão em {leg.escala_local}{leg.escala_duracao ? ` · espera de ${leg.escala_duracao}` : ''}
                                </p>
                              )}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <InfoRow label="Companhia / voo" value={[firstWord(leg.companhia), leg.numero].filter(Boolean).join(' · ') || '—'} />
                                <InfoRow label="Origem" value={leg.origem && (leg.hora_embarque || leg.data) ? <>{leg.origem} <span className="text-gray-400">· {fmtDate(leg.data)}{leg.hora_embarque ? ` ${leg.hora_embarque}` : ''}</span></> : leg.origem} />
                                <InfoRow label="Destino" value={leg.destino && (leg.hora_chegada || leg.data_chegada) ? <>{leg.destino} <span className="text-gray-400">· {leg.data_chegada ? `${fmtDate(leg.data_chegada)} ` : ''}{leg.hora_chegada || ''}</span></> : leg.destino} />
                                <InfoRow label="Duração" value={leg.duracao} />
                              </div>
                            </div>
                          ))}
                        </div>
                        {bagagem && <BaggageRow text={bagagem} />}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-3">
                  <InfoRow label="Companhia aérea" value={sale.airline} />
                  <InfoRow label="Data de ida" value={fmtDate(sale.departure_date)} />
                  <InfoRow label="Data de volta" value={fmtDate(sale.return_date)} />
                </div>
              )}
            </div>
          )}

          {hasHotel && (
            <div className="border rounded-md overflow-hidden break-inside-avoid">
              <SectionBar icon={Hotel} title="Hospedagem" accent={accent} />
              {hospedagens.length > 0 ? (
                <div className="divide-y">
                  {hospedagens.map(h => {
                    const d = h.data
                    const diarias = d.check_in && d.check_out
                      ? Math.round((new Date(`${d.check_out}T12:00:00`).getTime() - new Date(`${d.check_in}T12:00:00`).getTime()) / 86400000)
                      : null
                    return (
                      <div key={h.id} className="p-3 break-inside-avoid">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">{d.hotel || '—'}</p>
                          {d.localizador && <p className="text-[11px] font-mono text-gray-500">Localizador: {d.localizador}</p>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <InfoRow label="Check-in" value={d.check_in ? <>{fmtDate(d.check_in)}{d.hora_checkin ? ` · ${d.hora_checkin}` : ''}</> : '—'} />
                          <InfoRow label="Check-out" value={d.check_out ? <>{fmtDate(d.check_out)}{d.hora_checkout ? ` · ${d.hora_checkout}` : ''}</> : '—'} />
                          <InfoRow label="Diárias" value={diarias && diarias > 0 ? `${diarias} diária${diarias > 1 ? 's' : ''}` : '—'} />
                          <InfoRow label="Titular" value={d.titular || sale.client_name} />
                        </div>
                        {(d.tipo_quarto || d.regime) && (
                          <div className="grid grid-cols-2 gap-3 mt-1.5">
                            <InfoRow label="Tipo de quarto" value={d.tipo_quarto} />
                            <InfoRow label="Regime" value={d.regime} />
                          </div>
                        )}
                        {(d.endereco || d.email || d.telefone) && (
                          <div className="grid grid-cols-3 gap-3 mt-1.5">
                            <InfoRow label="Endereço" value={d.endereco} />
                            <InfoRow label="E-mail" value={d.email} />
                            <InfoRow label="Telefone" value={d.telefone} />
                          </div>
                        )}
                        {(d.informacoes_adicionais || d.politica_cancelamento || d.condicoes) && (
                          <div className="mt-2 pt-2 border-t space-y-1">
                            {d.informacoes_adicionais && <p className="text-[9px] text-gray-500 leading-snug"><span className="font-semibold">Informações adicionais:</span> {d.informacoes_adicionais}</p>}
                            {d.politica_cancelamento && <p className="text-[9px] text-gray-500 leading-snug"><span className="font-semibold">Política de cancelamento:</span> {d.politica_cancelamento}</p>}
                            {d.condicoes && <p className="text-[9px] text-gray-500 leading-snug"><span className="font-semibold">Condições da reserva:</span> {d.condicoes}</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <>
                  {sale.hotel_locator && (
                    <div className="px-3 pt-3">
                      <InfoRow label="Localizador" value={sale.hotel_locator} mono />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 p-3">
                    <InfoRow label="Hotel" value={sale.hotel_name} />
                    <InfoRow label="Localização" value={sale.destination} />
                    <InfoRow label="Check-in" value={fmtDate(sale.departure_date)} />
                    <InfoRow label="Check-out" value={fmtDate(sale.return_date)} />
                  </div>
                </>
              )}
            </div>
          )}

          {hasTraslado && (
            <div className="border rounded-md overflow-hidden break-inside-avoid">
              <SectionBar icon={Car} title="Traslados" accent={accent} />
              {transfers.length > 0 ? (
                <div className="divide-y">
                  {transfers.map(t => (
                    <div key={t.id} className="p-3 break-inside-avoid">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold">{[t.data.origem, t.data.destino].filter(Boolean).join(' → ') || t.data.tipo_servico || 'Transfer'}</p>
                        {t.data.codigo_reserva && <p className="text-[11px] font-mono text-gray-500">Código: {t.data.codigo_reserva}</p>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <InfoRow label="Titular" value={t.data.titular || sale.client_name} />
                        <InfoRow label="Data" value={t.data.data ? fmtDate(t.data.data) : '—'} />
                        <InfoRow label="Horário" value={t.data.horario} />
                        <InfoRow label="Tipo" value={t.data.tipo_servico} />
                      </div>
                      {(t.data.fornecedor || t.data.contato) && (
                        <div className="grid grid-cols-2 gap-3 mt-1.5">
                          <InfoRow label="Empresa/motorista" value={t.data.fornecedor} />
                          <InfoRow label="Contato" value={t.data.contato} />
                        </div>
                      )}
                      {t.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{t.data.observacoes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-gray-600">Traslado incluso no pacote — chegada e saída conforme itinerário combinado.</div>
              )}
            </div>
          )}

          {hasCruzeiro && (
            <div className="border rounded-md overflow-hidden break-inside-avoid">
              <SectionBar icon={Ship} title="Cruzeiro" accent={accent} />
              <div className="divide-y">
                {cruzeiros.map(c => (
                  <div key={c.id} className="p-3 break-inside-avoid">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold">{c.data.navio || c.data.companhia || 'Cruzeiro'}</p>
                      {c.data.localizador && <p className="text-[11px] font-mono text-gray-500">Localizador: {c.data.localizador}</p>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <InfoRow label="Titular" value={c.data.titular || sale.client_name} />
                      <InfoRow label="Roteiro" value={c.data.roteiro} />
                      <InfoRow label="Embarque" value={c.data.embarque_data ? <>{fmtDate(c.data.embarque_data)}{c.data.embarque_porto ? ` · ${c.data.embarque_porto}` : ''}</> : '—'} />
                      <InfoRow label="Desembarque" value={c.data.desembarque_data ? <>{fmtDate(c.data.desembarque_data)}{c.data.desembarque_porto ? ` · ${c.data.desembarque_porto}` : ''}</> : '—'} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1.5">
                      <InfoRow label="Cabine" value={c.data.cabine} />
                      <InfoRow label="Categoria" value={c.data.categoria} />
                      <InfoRow label="Deck" value={c.data.deck} />
                      <InfoRow label="Vista" value={c.data.vista} />
                    </div>
                    {(c.data.localizacao || c.data.regime) && (
                      <div className="grid grid-cols-2 gap-3 mt-1.5">
                        <InfoRow label="Localização" value={c.data.localizacao} />
                        <InfoRow label="Plano de alimentação" value={c.data.regime} />
                      </div>
                    )}
                    {c.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{c.data.observacoes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasPasseios && (
            <div className="border rounded-md overflow-hidden break-inside-avoid">
              <SectionBar icon={Compass} title="Passeios e ingressos" accent={accent} />
              {ingressos.length > 0 ? (
                <div className="divide-y">
                  {ingressos.map(p => (
                    <div key={p.id} className="p-3 break-inside-avoid">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold">{p.data.atracao || p.data.nome || 'Passeio/Ingresso'}</p>
                        {p.data.codigo_reserva && <p className="text-[11px] font-mono text-gray-500">Código: {p.data.codigo_reserva}</p>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <InfoRow label="Titular" value={p.data.titular || sale.client_name} />
                        <InfoRow label="Data" value={p.data.data ? fmtDate(p.data.data) : '—'} />
                        <InfoRow label="Prestador de serviço" value={p.data.fornecedor} />
                      </div>
                      {p.data.contato && <div className="mt-1.5"><InfoRow label="Contato" value={p.data.contato} /></div>}
                      {p.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{p.data.observacoes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-gray-600">Passeios inclusos no pacote — consulte roteiro e horários com o guia local.</div>
              )}
            </div>
          )}

          {hasServicos && (
            <div className="border rounded-md overflow-hidden break-inside-avoid">
              <SectionBar icon={Ticket} title="Serviços" accent={accent} />
              <div className="flex gap-1.5 flex-wrap p-3">
                {(all.includes('carros') || all.includes('car_rental')) && <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Locação de carro</span>}
                {all.includes('servicos') && <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Serviços diversos</span>}
              </div>
            </div>
          )}

          {hasSeguro && (
            <div className="border rounded-md overflow-hidden break-inside-avoid">
              <SectionBar icon={ShieldCheck} title="Seguro viagem" accent={accent} />
              {seguros.length > 0 ? (
                <div className="divide-y">
                  {seguros.map(s => (
                    <div key={s.id} className="p-3 break-inside-avoid">
                      <p className="text-sm font-semibold mb-1.5">{s.data.nome || 'Seguro viagem'}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <InfoRow label="Titular" value={s.data.titular || sale.client_name} />
                        <InfoRow label="Vigência a partir de" value={s.data.data ? fmtDate(s.data.data) : '—'} />
                        <InfoRow label="Apólice" value={s.data.localizador} />
                      </div>
                      {s.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{s.data.observacoes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-gray-600">Seguro viagem incluso — mantenha este voucher e o cartão do seguro em mãos durante a viagem.</div>
              )}
            </div>
          )}
        </div>

        {/* Operadora — sem informação de pagamento no voucher */}
        {sale.operator && (
          <div className="mb-6 rounded-md border p-4 break-inside-avoid">
            <InfoRow label="Operadora" value={sale.operator} />
          </div>
        )}

        {/* Política de cancelamento — bloco em destaque, igual ao modelo de referência */}
        {sale.cancellation_policy && (
          <div className="mb-6 rounded-md border-2 p-4 break-inside-avoid" style={{ borderColor: '#f59e0b' }}>
            <p className="text-xs uppercase tracking-wide font-bold mb-1.5 flex items-center gap-1.5" style={{ color: '#b45309' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> Política de cancelamento
            </p>
            <p className="text-xs whitespace-pre-wrap text-gray-700">{sale.cancellation_policy}</p>
          </div>
        )}

        {sale.important_info && (
          <div className="mb-6 break-inside-avoid">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Informações importantes
            </p>
            <p className="text-xs whitespace-pre-wrap">{sale.important_info}</p>
          </div>
        )}

        {sale.service_info && (
          <div className="mb-6 break-inside-avoid">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Informações de serviço
            </p>
            <p className="text-xs whitespace-pre-wrap">{sale.service_info}</p>
          </div>
        )}

        {sale.notes && (
          <div className="mb-6 break-inside-avoid">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Observações</p>
            <p className="text-xs whitespace-pre-wrap">{sale.notes}</p>
          </div>
        )}

        {qrData && (
          <div className="flex flex-col items-center gap-2 mt-auto pt-6 break-inside-avoid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrData} alt="QR code de check-in" className="w-32 h-32" />
            <p className="text-[11px] text-gray-500">Aponte a câmera para acessar o check-in online</p>
          </div>
        )}

        <div className="mt-10 pt-4 border-t text-center text-[10px] text-gray-400 space-y-1 break-inside-avoid">
          {(org.address_street || org.address_city) && (
            <p className="flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {[org.address_street, org.address_city, org.address_state, org.address_zip].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="flex items-center justify-center gap-1">
            <Hash className="w-3 h-3" /> Documento gerado por {org.name} — apresente este voucher junto a um documento de identificação.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          /* Margens reais em todos os lados — antes só a base tinha
             margem, topo/laterais ficavam a 0 e o conteúdo colava na
             borda física do papel. */
          @page { size: A4; margin: 15mm 14mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* break-inside:avoid não encolhe o bloco — só impede que ele seja
             cortado ao meio: se não couber no espaço restante da página,
             o navegador empurra o bloco inteiro pra próxima. Aplicado em
             cada seção (voo/hospedagem/produto) e em cada item dentro dela,
             pra nunca partir um card de produto ao meio. */
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
