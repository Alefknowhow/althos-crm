'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type ProposalRow = {
  id: string
  organization_id: string
  lead_id: string | null
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
  order_bumps: any[]
  total_cents: number
  pax_count: number | null
  price_per_person_cents: number | null
  payment: Record<string, any>
  company_override: Record<string, any> | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Whitelist of body fields a client may write. Keeps the jsonb shape predictable.
const WRITABLE = [
  'title', 'status', 'lead_id', 'start_date', 'end_date', 'client_name',
  'travelers', 'travelers_note', 'destinations', 'flights', 'hotels',
  'services', 'included', 'not_included', 'checklist', 'order_bumps',
  'total_cents', 'pax_count', 'price_per_person_cents', 'payment',
  'company_override', 'notes',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) {
    if (k in input) out[k] = input[k]
  }
  // Coerce integer money/count fields defensively.
  for (const k of ['total_cents', 'pax_count', 'price_per_person_cents'] as const) {
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
  revalidatePath(`/app/${orgSlug}/proposta`)
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

  revalidatePath(`/app/${orgSlug}/proposta`)
  revalidatePath(`/app/${orgSlug}/proposta/${id}`)
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
  revalidatePath(`/app/${orgSlug}/proposta`)
  return { ok: true as const }
}

// Lightweight lead list for the proposal → pipeline link picker.
export async function listLeadsForPicker(orgSlug: string): Promise<{ id: string; name: string }[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('leads')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data as { id: string; name: string }[]) ?? []
}
