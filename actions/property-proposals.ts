'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Propostas (Vertical Imobiliárias, Fase 3) — ver
 * supabase/migrations/0180_real_estate_proposals_deals.sql. Espelha
 * travel_proposals num formato menor: sem PDF/link público nesta fase.
 */

export type PropertyProposalStatus = 'draft' | 'sent' | 'viewed' | 'won' | 'lost' | 'expired'

export type PropertyProposalRow = {
  id: string
  property_id: string
  contato_id: string
  broker_user_id: string | null
  operation_type: 'venda' | 'locacao'
  offered_price_cents: number | null
  conditions: string | null
  valid_until: string | null
  status: PropertyProposalStatus
  notes: string | null
  created_at: string
  property_title: string | null
  property_code: string | null
  contato_name: string | null
}

const ProposalSchema = z.object({
  propertyId: z.string().uuid(),
  contatoId: z.string().uuid(),
  brokerUserId: z.string().uuid().nullable().optional(),
  operationType: z.enum(['venda', 'locacao']).optional(),
  offeredPriceCents: z.number().int().min(0).nullable().optional(),
  conditions: z.string().max(2000).nullable().optional(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

function mapRow(r: any): PropertyProposalRow {
  return {
    id: r.id, property_id: r.property_id, contato_id: r.contato_id, broker_user_id: r.broker_user_id,
    operation_type: r.operation_type, offered_price_cents: r.offered_price_cents, conditions: r.conditions,
    valid_until: r.valid_until, status: r.status, notes: r.notes, created_at: r.created_at,
    property_title: r.properties?.title ?? null, property_code: r.properties?.code ?? null,
    contato_name: r.contatos?.name ?? null,
  }
}

export async function listProposals(orgSlug: string, propertyId?: string): Promise<PropertyProposalRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  let query = supabase
    .from('property_proposals')
    .select('*, properties(title, code), contatos(name)')
    .eq('organization_id', org.id)
  if (propertyId) query = query.eq('property_id', propertyId)
  const { data } = await query.order('updated_at', { ascending: false }).limit(500)
  return (data || []).map(mapRow)
}

export async function getProposal(orgSlug: string, id: string): Promise<PropertyProposalRow | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('property_proposals')
    .select('*, properties(title, code), contatos(name)')
    .eq('id', id).eq('organization_id', org.id)
    .maybeSingle()
  return data ? mapRow(data) : null
}

export async function createProposal(orgSlug: string, input: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = ProposalSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()
  const { data, error } = await supabase
    .from('property_proposals')
    .insert({
      organization_id: org.id, property_id: v.propertyId, contato_id: v.contatoId,
      broker_user_id: v.brokerUserId ?? null, operation_type: v.operationType || 'venda',
      offered_price_cents: v.offeredPriceCents ?? null, conditions: v.conditions ?? null,
      valid_until: v.validUntil || null, notes: v.notes ?? null, created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar proposta' }

  revalidatePath(`/app/${orgSlug}/propostas`)
  revalidatePath(`/app/${orgSlug}/imoveis/${v.propertyId}`)
  return { ok: true as const, id: data.id as string }
}

export async function updateProposal(orgSlug: string, id: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = ProposalSchema.partial().safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const patch: Record<string, unknown> = {}
  if (v.brokerUserId !== undefined) patch.broker_user_id = v.brokerUserId
  if (v.operationType !== undefined) patch.operation_type = v.operationType
  if (v.offeredPriceCents !== undefined) patch.offered_price_cents = v.offeredPriceCents
  if (v.conditions !== undefined) patch.conditions = v.conditions
  if (v.validUntil !== undefined) patch.valid_until = v.validUntil || null
  if (v.notes !== undefined) patch.notes = v.notes

  const supabase = createClient()
  const { error } = await supabase.from('property_proposals').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/propostas`)
  return { ok: true as const }
}

export async function setProposalStatus(orgSlug: string, id: string, status: PropertyProposalStatus) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('property_proposals').update({ status }).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/propostas`)
  return { ok: true as const }
}
