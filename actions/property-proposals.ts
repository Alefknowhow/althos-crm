'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Propostas (Vertical Imobiliárias, Fases 3 e 8) — ver
 * supabase/migrations/0180_real_estate_proposals_deals.sql e
 * 0184_property_proposal_items_public_link.sql. Uma proposta pode ter
 * múltiplos imóveis, cada um com preço próprio (property_proposal_items,
 * mesmo desenho de quotation_products em Viagens — delete+reinsert total
 * a cada save) + link público via token (mesmo padrão de
 * generateQuotationLink/get_public_quotation).
 *
 * Colunas legadas `property_id`/`offered_price_cents` em
 * property_proposals (Fase 3) continuam existindo pra propostas antigas
 * — proposta nova sempre grava em property_proposal_items, mesmo quando
 * tem 1 imóvel só.
 */

export type PropertyProposalStatus = 'draft' | 'sent' | 'viewed' | 'won' | 'lost' | 'expired'

export type PropertyProposalItem = {
  propertyId: string
  priceCents: number
  title: string | null
  code: string | null
}

export type PropertyProposalRow = {
  id: string
  contato_id: string
  broker_user_id: string | null
  operation_type: 'venda' | 'locacao'
  conditions: string | null
  valid_until: string | null
  status: PropertyProposalStatus
  notes: string | null
  created_at: string
  public_token: string | null
  contato_name: string | null
  items: PropertyProposalItem[]
  totalCents: number
  // Legado (Fase 3, propostas de 1 imóvel só) — mantidos pra não quebrar
  // linhas antigas; proposta nova não grava mais aqui.
  property_id: string | null
  property_title: string | null
  property_code: string | null
}

const ProposalSchema = z.object({
  items: z.array(z.object({
    propertyId: z.string().uuid(),
    priceCents: z.number().int().min(0),
  })).min(1, 'Escolha pelo menos um imóvel'),
  contatoId: z.string().uuid(),
  brokerUserId: z.string().uuid().nullable().optional(),
  operationType: z.enum(['venda', 'locacao']).optional(),
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
  const items: PropertyProposalItem[] = (r.property_proposal_items || [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it: any) => ({
      propertyId: it.property_id, priceCents: it.price_cents,
      title: it.properties?.title ?? null, code: it.properties?.code ?? null,
    }))
  // Fallback pra propostas antigas (Fase 3, sem itens) — mostra o
  // property_id/offered_price_cents legado como item único.
  const effectiveItems = items.length > 0
    ? items
    : (r.property_id
      ? [{ propertyId: r.property_id, priceCents: r.offered_price_cents || 0, title: r.properties?.title ?? null, code: r.properties?.code ?? null }]
      : [])

  return {
    id: r.id, contato_id: r.contato_id, broker_user_id: r.broker_user_id,
    operation_type: r.operation_type, conditions: r.conditions,
    valid_until: r.valid_until, status: r.status, notes: r.notes, created_at: r.created_at,
    public_token: r.public_token ?? null,
    contato_name: r.contatos?.name ?? null,
    items: effectiveItems,
    totalCents: effectiveItems.reduce((a, it) => a + (it.priceCents || 0), 0),
    property_id: r.property_id ?? null,
    property_title: r.properties?.title ?? null, property_code: r.properties?.code ?? null,
  }
}

const SELECT = '*, properties(title, code), contatos(name), property_proposal_items(property_id, price_cents, sort_order, properties(title, code))'

export async function listProposals(orgSlug: string, propertyId?: string): Promise<PropertyProposalRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const query = supabase.from('property_proposals').select(SELECT).eq('organization_id', org.id)
  const { data } = await query.order('updated_at', { ascending: false }).limit(500)
  let rows = (data || []).map(mapRow)
  if (propertyId) rows = rows.filter(p => p.items.some(it => it.propertyId === propertyId))
  return rows
}

export async function getProposal(orgSlug: string, id: string): Promise<PropertyProposalRow | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('property_proposals').select(SELECT)
    .eq('id', id).eq('organization_id', org.id)
    .maybeSingle()
  return data ? mapRow(data) : null
}

async function replaceItems(supabase: ReturnType<typeof createClient>, orgId: string, proposalId: string, items: { propertyId: string; priceCents: number }[]) {
  const del = await supabase.from('property_proposal_items').delete().eq('proposal_id', proposalId)
  if (del.error) return del.error.message
  if (items.length === 0) return null
  const ins = await supabase.from('property_proposal_items').insert(
    items.map((it, i) => ({
      organization_id: orgId, proposal_id: proposalId, property_id: it.propertyId,
      price_cents: it.priceCents, sort_order: i,
    })),
  )
  return ins.error?.message ?? null
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
      organization_id: org.id, contato_id: v.contatoId,
      broker_user_id: v.brokerUserId ?? null, operation_type: v.operationType || 'venda',
      conditions: v.conditions ?? null, valid_until: v.validUntil || null,
      notes: v.notes ?? null, created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar proposta' }

  const itemsErr = await replaceItems(supabase, org.id, data.id, v.items)
  if (itemsErr) return { ok: false as const, error: itemsErr }

  revalidatePath(`/app/${orgSlug}/propostas`)
  for (const it of v.items) revalidatePath(`/app/${orgSlug}/imoveis/${it.propertyId}`)
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
  if (v.conditions !== undefined) patch.conditions = v.conditions
  if (v.validUntil !== undefined) patch.valid_until = v.validUntil || null
  if (v.notes !== undefined) patch.notes = v.notes

  const supabase = createClient()
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('property_proposals').update(patch).eq('id', id).eq('organization_id', org.id)
    if (error) return { ok: false as const, error: error.message }
  }

  if (v.items) {
    const itemsErr = await replaceItems(supabase, org.id, id, v.items)
    if (itemsErr) return { ok: false as const, error: itemsErr }
  }

  const { data: existing } = await supabase.from('property_proposals').select('public_token').eq('id', id).maybeSingle()
  if (existing?.public_token) revalidateTag(`property-proposal:${existing.public_token}`)
  revalidatePath(`/app/${orgSlug}/propostas`)
  return { ok: true as const }
}

export async function setProposalStatus(orgSlug: string, id: string, status: PropertyProposalStatus) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data: proposal, error } = await supabase
    .from('property_proposals')
    .update({ status })
    .eq('id', id).eq('organization_id', org.id)
    .select('property_id, contato_id, property_proposal_items(property_id)')
    .maybeSingle()
  if (error || !proposal) return { ok: false as const, error: error?.message || 'Proposta não encontrada' }

  if (status === 'sent') {
    const firstPropertyId = (proposal as any).property_proposal_items?.[0]?.property_id || proposal.property_id
    await inngest.send({
      name: 'imoveis.proposal.sent',
      data: { orgId: org.id, leadId: proposal.contato_id, propertyId: firstPropertyId, proposalId: id },
    })
  }

  revalidatePath(`/app/${orgSlug}/propostas`)
  return { ok: true as const }
}

/** Gera/rotaciona o token do link público — mesmo padrão de generateQuotationLink (actions/quotations.ts). */
export async function generatePropertyProposalLink(orgSlug: string, id: string, rotate = false) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data: p } = await supabase
    .from('property_proposals').select('id, public_token, status')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!p) return { ok: false as const, error: 'Proposta não encontrada' }

  const oldToken = p.public_token
  const token = rotate || !oldToken
    ? Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
    : oldToken

  const { error } = await supabase.from('property_proposals').update({
    public_token: token,
    status: p.status === 'draft' ? 'sent' : p.status,
  }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }

  if (oldToken && oldToken !== token) revalidateTag(`property-proposal:${oldToken}`)
  revalidateTag(`property-proposal:${token}`)
  revalidatePath(`/app/${orgSlug}/propostas`)
  return { ok: true as const, token }
}
