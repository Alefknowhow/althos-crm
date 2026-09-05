// Shared types/constants/helpers used by LeadsView.tsx and its extracted
// sibling components (FilterSheet, SavedFilterMenu, ColumnsMenu,
// NewLeadDialog, BulkBar, LeadsTable). Pure code motion — no behavior change.

export type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  stage_id: string | null
  tags: string[] | null
  value_cents: number | null
  source: string | null
  created_at: string
  updated_at: string
  ai_score?: number | null
  ai_tier?: 'hot' | 'warm' | 'cold' | string | null
  ai_summary?: string | null
  pipeline_stages: { id: string; name: string } | { id: string; name: string }[] | null
}

export type Stage = { id: string; name: string; pipeline_id?: string }
export type Pipeline = { id: string; name: string; is_default: boolean }

export const ALL_COLUMNS = [
  { key: 'contact', label: 'Contato' },
  { key: 'score', label: 'Score IA' },
  { key: 'stage', label: 'Estágio' },
  { key: 'tags', label: 'Tags' },
  { key: 'value', label: 'Valor' },
  { key: 'source', label: 'Origem' },
  { key: 'last_activity', label: 'Última atividade' },
  { key: 'created', label: 'Criado em' },
] as const

export type ColKey = (typeof ALL_COLUMNS)[number]['key']

export const STORAGE_KEY = 'althos.leads.columns.v1'

export function getStageName(lead: Lead): string {
  const s = lead.pipeline_stages
  if (!s) return 'Sem estágio'
  if (Array.isArray(s)) return s[0]?.name || 'Sem estágio'
  return s.name
}

export function buildWhatsAppUrl(phone: string | null) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.length === 11 || digits.length === 10 ? `55${digits}` : digits}`
}
