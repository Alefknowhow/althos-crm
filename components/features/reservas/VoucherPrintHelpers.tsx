/**
 * Shared types + formatting/presentational helpers for VoucherPrintView.
 * Split out of VoucherPrintView.tsx — pure, prop-driven, no shared state.
 */

import { Backpack, Briefcase, Luggage } from 'lucide-react'

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

export type ContatoInfo = { phone: string | null; email: string | null; date_of_birth: string | null } | null

export type VooLeg = {
  companhia?: string | null; numero?: string | null; data?: string | null
  origem?: string | null; destino?: string | null; horario?: string | null
  localizador_checkin?: string | null; bilhete?: string | null
  hora_embarque?: string | null; data_chegada?: string | null; hora_chegada?: string | null
  duracao?: string | null; bagagem?: string | null
  escala_local?: string | null; escala_duracao?: string | null
}
export type VooProduct = {
  id: string
  data: {
    companhia?: string | null; sentido?: string | null; localizador?: string | null
    bilhete?: string | null; hora_embarque?: string | null; hora_chegada?: string | null
    bagagem?: string | null; origem?: string | null; destino?: string | null
    legs?: VooLeg[]
  }
}
export type HospedagemProduct = {
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
export type GenericProduct = { id: string; kind: string; data: Record<string, any> }

export function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}

/** Só a primeira palavra do nome da companhia ("LATAM Airlines Group" →
 *  "LATAM") — junto com o número do voo (que já inclui as letras do
 *  código, ex.: "LA3737"), evita que "Companhia / voo" quebre linha na
 *  grade de 4 colunas. */
export function firstWord(name?: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null
}

export function nights(a?: string | null, b?: string | null) {
  if (!a || !b) return null
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()
  const n = Math.round(ms / 86400000)
  return n > 0 ? n : null
}

// Cabeçalho de seção — barra sólida na cor da marca, ícone + título, no
// mesmo espírito das barras "VOUCHER DE HOTEL / VOUCHER DE VOO" do modelo
// de referência (operadora azul).
export function SectionBar({ icon: Icon, title, accent }: { icon: React.ElementType; title: string; accent: string }) {
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

export function BaggageRow({ text }: { text: string }) {
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

export function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
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
export function CompactField({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] whitespace-nowrap ${className || ''}`}>
      {label && <span className="text-gray-400 uppercase tracking-wide text-[9px] font-semibold mr-1">{label}</span>}
      <span className="font-medium">{value ?? '—'}</span>
    </span>
  )
}
