/**
 * Shared types and small formatting helpers for ContatosView and its
 * split-out sub-components. Split out of ContatosView.tsx.
 */

import { CONTATO_STATUSES } from '@/lib/contatos'
import type { SavedFilter } from '@/actions/saved_filters'
import type { ContatoContactPoint } from '@/actions/contatos'

export type ListRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string | null
  source: string | null
  avatar_url: string | null
  city: string | null
  state: string | null
  tags: string[] | null
  value_cents: number | null
  became_customer_at: string | null
  last_activity_at: string | null
  created_at: string | null
  updated_at: string | null
  ai_tier: string | null
  has_documents: boolean
}

export type Sale = {
  id: string
  sale_date: string | null
  amount_cents: number | null
  status: string | null
  payment_method: string | null
  installments: number | null
  products: { name: string } | null
}

export type Selected = {
  contato: any
  documents: any[]
  sales: Sale[]
  relationships: any[]
  propertyInterests?: any[]
  propertyVisits?: any[]
  propertyPreferences?: any
  contactPoints: ContatoContactPoint[]
  activities: any[]
  tasks: any[]
  emailSends: any[]
  templates: any[]
  whatsappConv: any | null
  travelReservas?: any[]
  travelCotacoes?: any[]
} | null

export type Filters = Record<string, string | undefined>

export interface Props {
  orgSlug: string
  contatos: ListRow[]
  selected: Selected
  selectedId: string
  total: number
  page: number
  pageSize: number
  pipelines: { id: string; name: string; is_default: boolean }[]
  allTags: string[]
  allSources: string[]
  savedFilters: SavedFilter[]
  filters: Filters
  isTravel: boolean
  isRealEstate?: boolean
  properties?: { id: string; title: string; code: string | null }[]
  members: { id: string; name: string }[]
  statusTabs?: React.ReactNode
  orgName: string
  /** Templates de WhatsApp aprovados — alimenta o seletor de template do
   *  disparo manual de NPS (ver NpsSection.tsx). Filtrado a status='approved'
   *  já na página server-side; a Meta rejeita texto livre fora da janela de
   *  24h, então só faz sentido oferecer templates já aprovados aqui. */
  whatsappTemplates?: import('@/actions/whatsapp-templates').WaTemplate[]
}

// ── Helpers ──────────────────────────────────────────────────────────
export function fmtCurrency(cents: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}
export function fmtDate(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}
export function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name || '?').slice(0, 2).toUpperCase()
}
export function relativeTime(d: string | null | undefined): string {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `há ${months}m`
  return `há ${Math.floor(months / 12)}a`
}
export function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

export const STATUS_VALUES = CONTATO_STATUSES

