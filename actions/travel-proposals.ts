'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type ProposalRow = {
  id: string
  organization_id: string
  contato_id: string | null
  created_by: string | null
  title: string | null
  status: string
  public_token: string | null
  start_date: string | null
  end_date: string | null
  client_name: string | null
  travelers: any[]
  travelers_note: string | null
  destinations: any[]
  flights: any[]
  hotels: any[]
  services: Record<string, any>
  included: string[]
  not_included: string[]
  checklist: string[]
  photos: string[]
  order_bumps: any[]
  total_cents: number
  pax_count: number | null
  price_per_person_cents: number | null
  payment: Record<string, any>
  weather: Record<string, any>
  map_config: Record<string, any> | null
  company_override: Record<string, any> | null
  notes: string | null
  // Internal-only (never shown on the public proposal/PDF).
  operadora: string | null
  commission_total_cents: number
  created_at: string
  updated_at: string
}

// Whitelist of body fields a client may write. Keeps the jsonb shape predictable.
const WRITABLE = [
  'title', 'status', 'contato_id', 'start_date', 'end_date', 'client_name',
  'travelers', 'travelers_note', 'destinations', 'flights', 'hotels',
  'services', 'included', 'not_included', 'checklist', 'photos', 'order_bumps',
  'total_cents', 'pax_count', 'price_per_person_cents', 'payment',
  'weather', 'map_config',
  'company_override', 'notes', 'operadora', 'commission_total_cents',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) {
    if (k in input) out[k] = input[k]
  }
  // Coerce integer money/count fields defensively.
  for (const k of ['total_cents', 'pax_count', 'price_per_person_cents', 'commission_total_cents'] as const) {
    if (k in out) {
      const n = Number(out[k])
      out[k] = Number.isFinite(n) ? Math.round(n) : 0
    }
  }
  return out
}

export async function listProposals(orgSlug: string): Promise<ProposalRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_proposals')
    .select('*')
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data as ProposalRow[]) ?? []
}

export async function getProposal(orgSlug: string, id: string): Promise<ProposalRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_proposals')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as ProposalRow) ?? null
}

export async function createProposal(orgSlug: string, input: Record<string, any> = {}) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_proposals')
    .insert({
      ...pick(input),
      title: input.title || 'Nova proposta',
      organization_id: org.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao criar proposta' }
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, data: data as ProposalRow }
}

export async function updateProposal(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_proposals')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message || 'Erro ao salvar proposta' }
  // 0 rows → the proposal doesn't belong to this org or was removed. Surface a
  // clear message rather than silently "succeeding" with stale public data.
  if (!data) return { ok: false as const, error: 'Proposta não encontrada nesta organização.' }

  revalidatePath(`/app/${orgSlug}/cotacoes`)
  revalidatePath(`/app/${orgSlug}/cotacoes/${id}`)
  // The public client link reads by token (force-dynamic, no cache) so it
  // reflects this update on the next load — nothing else to revalidate.
  return { ok: true as const, data: data as ProposalRow }
}

export async function deleteProposal(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('travel_proposals')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir proposta' }
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const }
}

// Duplicate an existing proposal onto another contato/lead. Copies the full
// content (destinations, hotels, prices, etc.) but resets identity fields:
// a fresh row, no public_token (a new link is generated on first share),
// status back to "draft" (Rascunho), and the chosen contato's name as client_name.
export async function duplicateProposal(orgSlug: string, sourceId: string, targetContatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  // Load the source within this org (RLS-safe via explicit org filter).
  const { data: source, error: srcErr } = await supabase
    .from('travel_proposals')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', sourceId)
    .maybeSingle()
  if (srcErr) return { ok: false as const, error: srcErr.message || 'Erro ao carregar a proposta de origem.' }
  if (!source) return { ok: false as const, error: 'Proposta de origem não encontrada nesta organização.' }

  // Resolve the target contato (for client_name + ownership validation).
  const { data: contato, error: contErr } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('id', targetContatoId)
    .maybeSingle()
  if (contErr) return { ok: false as const, error: contErr.message || 'Erro ao carregar o contato de destino.' }
  if (!contato) return { ok: false as const, error: 'Contato de destino não encontrado nesta organização.' }

  // Copy only the whitelisted content fields, then override identity fields.
  const copy = pick(source as Record<string, any>)
  const { data, error } = await supabase
    .from('travel_proposals')
    .insert({
      ...copy,
      title: `${(source as ProposalRow).title || 'Proposta'} (cópia)`,
      status: 'draft',
      contato_id: contato.id,
      client_name: (contato as any).name || copy.client_name || null,
      public_token: null,
      organization_id: org.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao duplicar proposta.' }
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, data: data as ProposalRow }
}

// Cotações (proposals) linked to a specific lead — for the pipeline card popup.
export type LeadProposalRow = {
  id: string
  title: string | null
  status: string
  total_cents: number
  start_date: string | null
  end_date: string | null
  public_token: string | null
  updated_at: string
}

export async function listProposalsForLead(orgSlug: string, leadId: string): Promise<LeadProposalRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_proposals')
    .select('id, title, status, total_cents, start_date, end_date, public_token, updated_at')
    .eq('organization_id', org.id)
    .eq('contato_id', leadId)
    .order('updated_at', { ascending: false })
    .limit(100)
  return (data as LeadProposalRow[]) ?? []
}

// Lightweight lead list for the proposal → pipeline link picker.
export async function listLeadsForPicker(orgSlug: string): Promise<{ id: string; name: string }[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data as { id: string; name: string }[]) ?? []
}
