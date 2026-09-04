'use client'

/**
 * Product cards + formatting helpers for QuotationPrintView's document.
 * Split out of QuotationPrintView.tsx — pure, prop-driven, no shared state.
 */

import { useState, useEffect } from 'react'
import { Car, Shield, Package, Ticket, KeyRound } from 'lucide-react'
import { HotelCard, CruiseCard } from './QuotationPrintStayCards'

/* ───────────────────────── tipos ───────────────────────── */

export type OrgBranding = {
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

export type Seller = { name: string; email?: string | null; phone?: string | null } | null

export type Payment = { enabled: boolean; url?: string | null; qr_code?: string | null } | null

/** Produto genérico como vem de quotation_products — cada tipo lê de
 *  `data` os campos que interessam (ver PRODUCT_REGISTRY). */
export type Product = {
  id: string
  type: string
  name: string | null
  summary: string | null
  date_start: string | null
  date_end: string | null
  data: Record<string, any>
}

export type Quotation = {
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

export function fmtDate(d?: string | null) {
  if (!d) return null
  const datePart = d.slice(0, 10)
  const dt = new Date(datePart + 'T12:00:00')
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('pt-BR')
}
export function fmtCurrency(cents: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}
/** "20 de agosto de 2026" — data por extenso, usada na frase "Esta cotação
 *  foi realizada no dia…" abaixo do título. */
export function fmtDateExtenso(d?: string | null): string | null {
  if (!d) return null
  const dt = new Date(d.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}
/** (dd) xxxxx-xxxx — extrai só os dígitos e formata; se não tiver DDD (10/11
 *  dígitos) retorna o texto original sem tentar adivinhar. */
export function fmtPhone(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}
/** 99999-999 — cep já vem só com dígitos ou já formatado do cadastro da
 *  agência; normaliza pros dois casos. */
export function fmtCep(cep?: string | null): string | null {
  if (!cep) return null
  const digits = cep.replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep
}
export function stripHtml(html?: string | null) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
export function hasHtml(html?: string | null): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim() !== '' || /<img/i.test(html)
}

export function Rich({ html, className, onReady }: { html?: string | null; className?: string; onReady?: () => void }) {
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
export function InfoField({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="min-w-0">
      <p className="text-[6.5pt] uppercase tracking-wide text-[#777]">{label}</p>
      <p className="text-[8.5pt] font-semibold text-[#111] truncate">{value}</p>
    </div>
  )
}

/* ─────────────── header de cada Product Card ─────────────── */

export function CardHeader({ icon: Icon, title, right }: { icon: any; title: string; right?: React.ReactNode }) {
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

export function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="avoid-break border-[0.8pt] border-[#C8C8C8] rounded-[4mm] bg-white p-[4mm] mb-[5mm]">
      {children}
    </div>
  )
}

/* ───────────────────────── Transfer / Seguro / genérico ───────────────────────── */

function TransferCard({ p }: { p: Product }) {
  const d = p.data
  return (
    <CardShell>
      <CardHeader icon={Car} title={d.round_trip ? 'Transfer (ida e volta)' : 'Transfer'} />
      {p.name && <p className="text-[11pt] font-bold text-[#111] mb-[2.5mm]">{p.name}</p>}
      <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Origem" value={d.origin} />
        <InfoField label="Destino" value={d.destination} />
        <InfoField label="Data" value={fmtDate(p.date_start)} />
        <InfoField label="Horário" value={d.time} />
        {d.round_trip && <InfoField label="Data da volta" value={fmtDate(d.return_date)} />}
        {d.round_trip && <InfoField label="Horário da volta" value={d.return_time} />}
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

export const PRODUCT_LABELS: Record<string, string> = {
  aereo: 'Aéreo', hospedagem: 'Hospedagem', cruzeiro: 'Cruzeiro',
  transfer: 'Transfer', seguro: 'Seguro viagem', passeio: 'Passeio', locacao: 'Locação',
}

/** Card por product_type — usada pelo dispatcher de renderUnits em
 *  QuotationPrintView (tudo exceto 'aereo', que é tratado à parte porque
 *  todas as pernas de voo viram um card único). */
export function ProductCard({ p }: { p: Product }) {
  switch (p.type) {
    case 'hospedagem': return <HotelCard p={p} />
    case 'cruzeiro': return <CruiseCard p={p} />
    case 'transfer': return <TransferCard p={p} />
    case 'seguro': return <InsuranceCard p={p} />
    case 'passeio': return <TourCard p={p} />
    case 'locacao': return <RentalCard p={p} />
    default: return <GenericProductCard p={p} label={PRODUCT_LABELS[p.type] || p.type} />
  }
}
