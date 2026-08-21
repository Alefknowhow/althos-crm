'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'

/**
 * Negociação/Venda-Locação (Vertical Imobiliárias, Fase 3) — ver
 * supabase/migrations/0180_real_estate_proposals_deals.sql. Fecha o
 * funil: registra o negócio, muda o status do imóvel, marca a proposta
 * de origem como ganha e sincroniza UMA linha de comissão em
 * financial_entries (versão simplificada do syncSaleRevenueEntry de
 * Viagens — sem split retida/repasse, que só existe lá por causa do
 * repasse de operadora).
 */

export type PropertyDealRow = {
  id: string
  property_id: string
  proposal_id: string | null
  contato_id: string
  owner_contato_id: string | null
  broker_user_id: string | null
  deal_type: 'venda' | 'locacao'
  final_price_cents: number
  commission_cents: number | null
  monthly_rent_cents: number | null
  lease_start_date: string | null
  lease_end_date: string | null
  status: 'aberto' | 'cancelado'
  closed_at: string
  notes: string | null
  property_title: string | null
  property_code: string | null
  contato_name: string | null
}

const CloseDealSchema = z.object({
  propertyId: z.string().uuid(),
  proposalId: z.string().uuid().nullable().optional(),
  contatoId: z.string().uuid(),
  brokerUserId: z.string().uuid().nullable().optional(),
  dealType: z.enum(['venda', 'locacao']),
  finalPriceCents: z.number().int().min(1),
  commissionCents: z.number().int().min(0).nullable().optional(),
  monthlyRentCents: z.number().int().min(0).nullable().optional(),
  leaseStartDate: z.string().nullable().optional(),
  leaseEndDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

function mapRow(r: any): PropertyDealRow {
  return {
    id: r.id, property_id: r.property_id, proposal_id: r.proposal_id, contato_id: r.contato_id,
    owner_contato_id: r.owner_contato_id, broker_user_id: r.broker_user_id, deal_type: r.deal_type,
    final_price_cents: r.final_price_cents, commission_cents: r.commission_cents,
    monthly_rent_cents: r.monthly_rent_cents, lease_start_date: r.lease_start_date, lease_end_date: r.lease_end_date,
    status: r.status, closed_at: r.closed_at, notes: r.notes,
    property_title: r.properties?.title ?? null, property_code: r.properties?.code ?? null,
    contato_name: r.contatos?.name ?? null,
  }
}

export async function listDeals(orgSlug: string, propertyId?: string): Promise<PropertyDealRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  let query = supabase
    .from('property_deals')
    .select('*, properties(title, code), contatos(name)')
    .eq('organization_id', org.id)
  if (propertyId) query = query.eq('property_id', propertyId)
  const { data } = await query.order('closed_at', { ascending: false }).limit(500)
  return (data || []).map(mapRow)
}

export async function getDeal(orgSlug: string, id: string): Promise<PropertyDealRow | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('property_deals')
    .select('*, properties(title, code), contatos(name)')
    .eq('id', id).eq('organization_id', org.id)
    .maybeSingle()
  return data ? mapRow(data) : null
}

export async function closeDeal(orgSlug: string, input: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = CloseDealSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()

  const { data: property } = await supabase
    .from('properties').select('owner_contato_id').eq('id', v.propertyId).eq('organization_id', org.id).maybeSingle()
  if (!property) return { ok: false as const, error: 'Imóvel não encontrado' }

  const { data: deal, error } = await supabase
    .from('property_deals')
    .insert({
      organization_id: org.id, property_id: v.propertyId, proposal_id: v.proposalId ?? null,
      contato_id: v.contatoId, owner_contato_id: property.owner_contato_id, broker_user_id: v.brokerUserId ?? null,
      deal_type: v.dealType, final_price_cents: v.finalPriceCents, commission_cents: v.commissionCents ?? null,
      monthly_rent_cents: v.monthlyRentCents ?? null, lease_start_date: v.leaseStartDate || null,
      lease_end_date: v.leaseEndDate || null, notes: v.notes ?? null, created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !deal) return { ok: false as const, error: error?.message || 'Erro ao fechar negócio' }

  // Imóvel sai de circulação — vendido/alugado já existem no CHECK de
  // properties.status desde a Fase 1, sem migração nova.
  await supabase
    .from('properties')
    .update({ status: v.dealType === 'locacao' ? 'alugado' : 'vendido', updated_at: new Date().toISOString() })
    .eq('id', v.propertyId).eq('organization_id', org.id)

  if (v.proposalId) {
    await supabase.from('property_proposals').update({ status: 'won' }).eq('id', v.proposalId).eq('organization_id', org.id)
  }

  // Comissão → Financeiro: uma linha "pendente", sem split retida/repasse
  // (não existe operadora em imóveis pra justificar a complexidade do
  // syncSaleRevenueEntry de Viagens).
  if (v.commissionCents && v.commissionCents > 0) {
    await supabase.from('financial_entries').insert({
      organization_id: org.id, tipo: 'receita', categoria: 'Comissão imobiliária',
      valor_cents: v.commissionCents, status: 'pendente', contato_id: v.contatoId,
      property_deal_id: deal.id, created_by: user.id,
    })
  }

  await inngest.send({
    name: 'imoveis.deal.closed',
    data: { orgId: org.id, leadId: v.contatoId, propertyId: v.propertyId, dealId: deal.id },
  })

  revalidatePath(`/app/${orgSlug}/negociacoes`)
  revalidatePath(`/app/${orgSlug}/propostas`)
  revalidatePath(`/app/${orgSlug}/imoveis/${v.propertyId}`)
  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, id: deal.id as string }
}

export async function cancelDeal(orgSlug: string, id: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: deal, error } = await supabase
    .from('property_deals')
    .update({ status: 'cancelado' })
    .eq('id', id).eq('organization_id', org.id)
    .select('property_id')
    .maybeSingle()
  if (error || !deal) return { ok: false as const, error: error?.message || 'Negócio não encontrado' }

  await supabase
    .from('properties')
    .update({ status: 'disponivel', updated_at: new Date().toISOString() })
    .eq('id', deal.property_id).eq('organization_id', org.id)

  await supabase
    .from('financial_entries')
    .update({ status: 'cancelado' })
    .eq('property_deal_id', id).eq('organization_id', org.id)
    .in('status', ['pendente', 'vencido'])

  revalidatePath(`/app/${orgSlug}/negociacoes`)
  revalidatePath(`/app/${orgSlug}/imoveis/${deal.property_id}`)
  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
}
