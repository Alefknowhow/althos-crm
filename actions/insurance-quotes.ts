'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Cotações (Vertical Seguros, Fase 2) — ver
 * supabase/migrations/0186_insurance_quotes.sql. Espelha
 * property_proposals/property_proposal_items (Imobiliárias) 1:1: uma
 * cotação (cliente + produto) pode comparar N seguradoras, cada uma com
 * prêmio/cobertura/franquia/condições próprios.
 */

export type InsuranceQuoteStatus =
  | 'rascunho' | 'em_cotacao' | 'recebida' | 'em_analise' | 'apresentada'
  | 'em_negociacao' | 'aprovada' | 'recusada' | 'expirada' | 'cancelada'

export type InsuranceQuoteItem = {
  insurerId: string
  premiumCents: number | null
  coverage: string | null
  franquia: string | null
  conditions: string | null
  insurerName: string | null
  insurerLogo: string | null
}

export type InsuranceQuoteRow = {
  id: string
  contato_id: string
  insurance_product_id: string
  broker_user_id: string | null
  status: InsuranceQuoteStatus
  valid_until: string | null
  notes: string | null
  created_at: string
  contato_name: string | null
  product_name: string | null
  items: InsuranceQuoteItem[]
  lowestPremiumCents: number | null
}

const QuoteSchema = z.object({
  contatoId: z.string().uuid(),
  insuranceProductId: z.string().uuid(),
  brokerUserId: z.string().uuid().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(z.object({
    insurerId: z.string().uuid(),
    premiumCents: z.number().int().min(0).nullable().optional(),
    coverage: z.string().max(500).nullable().optional(),
    franquia: z.string().max(200).nullable().optional(),
    conditions: z.string().max(2000).nullable().optional(),
  })).min(1, 'Escolha pelo menos uma seguradora'),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'seguros')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

const SELECT = '*, contatos(name), insurance_products(name), insurance_quote_items(insurer_id, premium_cents, coverage, franquia, conditions, sort_order, insurers(name, logo_storage_key))'

function mapRow(r: any): InsuranceQuoteRow {
  const items: InsuranceQuoteItem[] = (r.insurance_quote_items || [])
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it: any) => ({
      insurerId: it.insurer_id, premiumCents: it.premium_cents, coverage: it.coverage,
      franquia: it.franquia, conditions: it.conditions,
      insurerName: it.insurers?.name ?? null, insurerLogo: it.insurers?.logo_storage_key ?? null,
    }))
  const premiums = items.map(it => it.premiumCents).filter((v): v is number => v != null)

  return {
    id: r.id, contato_id: r.contato_id, insurance_product_id: r.insurance_product_id,
    broker_user_id: r.broker_user_id, status: r.status, valid_until: r.valid_until, notes: r.notes,
    created_at: r.created_at,
    contato_name: r.contatos?.name ?? null, product_name: r.insurance_products?.name ?? null,
    items, lowestPremiumCents: premiums.length > 0 ? Math.min(...premiums) : null,
  }
}

async function replaceItems(supabase: ReturnType<typeof createClient>, orgId: string, quoteId: string, items: z.infer<typeof QuoteSchema>['items']) {
  const del = await supabase.from('insurance_quote_items').delete().eq('quote_id', quoteId)
  if (del.error) return del.error.message
  if (items.length === 0) return null
  const ins = await supabase.from('insurance_quote_items').insert(
    items.map((it, i) => ({
      organization_id: orgId, quote_id: quoteId, insurer_id: it.insurerId,
      premium_cents: it.premiumCents ?? null, coverage: it.coverage ?? null,
      franquia: it.franquia ?? null, conditions: it.conditions ?? null, sort_order: i,
    })),
  )
  return ins.error?.message ?? null
}

export async function listQuotes(orgSlug: string): Promise<InsuranceQuoteRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurance_quotes').select(SELECT)
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data || []).map(mapRow)
}

export async function getQuote(orgSlug: string, id: string): Promise<InsuranceQuoteRow | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurance_quotes').select(SELECT)
    .eq('id', id).eq('organization_id', org.id)
    .maybeSingle()
  return data ? mapRow(data) : null
}

export async function createQuote(orgSlug: string, input: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = QuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()
  const { data, error } = await supabase
    .from('insurance_quotes')
    .insert({
      organization_id: org.id, contato_id: v.contatoId, insurance_product_id: v.insuranceProductId,
      broker_user_id: v.brokerUserId ?? null, valid_until: v.validUntil || null,
      notes: v.notes ?? null, created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar cotação' }

  const itemsErr = await replaceItems(supabase, org.id, data.id, v.items)
  if (itemsErr) return { ok: false as const, error: itemsErr }

  revalidatePath(`/app/${orgSlug}/cotacoes-seguro`)
  return { ok: true as const, id: data.id as string }
}

export async function updateQuote(orgSlug: string, id: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = QuoteSchema.partial().safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const patch: Record<string, unknown> = {}
  if (v.contatoId !== undefined) patch.contato_id = v.contatoId
  if (v.insuranceProductId !== undefined) patch.insurance_product_id = v.insuranceProductId
  if (v.brokerUserId !== undefined) patch.broker_user_id = v.brokerUserId
  if (v.validUntil !== undefined) patch.valid_until = v.validUntil || null
  if (v.notes !== undefined) patch.notes = v.notes

  const supabase = createClient()
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('insurance_quotes').update(patch).eq('id', id).eq('organization_id', org.id)
    if (error) return { ok: false as const, error: error.message }
  }

  if (v.items) {
    const itemsErr = await replaceItems(supabase, org.id, id, v.items)
    if (itemsErr) return { ok: false as const, error: itemsErr }
  }

  revalidatePath(`/app/${orgSlug}/cotacoes-seguro`)
  return { ok: true as const }
}

export async function setQuoteStatus(orgSlug: string, id: string, status: InsuranceQuoteStatus) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('insurance_quotes').update({ status }).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/cotacoes-seguro`)
  return { ok: true as const }
}
