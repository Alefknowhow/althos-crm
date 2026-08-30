'use server'

import { isSuperAdmin } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getPlanMeta, type PlanId } from '@/lib/plans/config'

/**
 * Calculadora de precificação de créditos de IA (super-admin). Fonte de
 * verdade AO VIVO do custo cobrado por ação (ai_action_cost_catalog) e do
 * cálculo de quanto vale 1 crédito em R$ (ai_credit_pricing_settings) — ver
 * supabase/migrations/0214_ai_credit_pricing_engine.sql e lib/plans/pricing.ts
 * (que lê credits_cost em runtime).
 */

export type AiActionCost = {
  action_key: string
  label: string
  typical_provider: 'anthropic' | 'gemini'
  typical_model: string
  avg_input_tokens: number
  avg_output_tokens: number
  avg_cost_usd_cents: number
  credits_cost: number
  recommended_credits_cost: number | null
  notes: string | null
  updated_at: string
}

export async function listActionCostCatalog(): Promise<AiActionCost[]> {
  if (!(await isSuperAdmin())) return []
  const admin = createAdminClient()
  const { data } = await admin.from('ai_action_cost_catalog').select('*').order('avg_cost_usd_cents', { ascending: false })
  return (data as AiActionCost[]) || []
}

export type AiActionCostInput = {
  typical_provider?: 'anthropic' | 'gemini'
  typical_model?: string
  avg_input_tokens?: number
  avg_output_tokens?: number
  avg_cost_usd_cents?: number
  credits_cost?: number
  notes?: string | null
}

export async function updateActionCostCatalog(actionKey: string, input: AiActionCostInput) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const admin = createAdminClient()
  const patch: Record<string, unknown> = {}
  if (input.typical_provider !== undefined) patch.typical_provider = input.typical_provider
  if (input.typical_model !== undefined) patch.typical_model = input.typical_model
  if (input.avg_input_tokens !== undefined) patch.avg_input_tokens = input.avg_input_tokens
  if (input.avg_output_tokens !== undefined) patch.avg_output_tokens = input.avg_output_tokens
  if (input.avg_cost_usd_cents !== undefined) patch.avg_cost_usd_cents = input.avg_cost_usd_cents
  if (input.credits_cost !== undefined) patch.credits_cost = input.credits_cost
  if (input.notes !== undefined) patch.notes = input.notes || null

  const { error } = await admin.from('ai_action_cost_catalog').update(patch).eq('action_key', actionKey)
  if (error) return { ok: false as const, error: error.message }
  await recomputePricingSettings()
  revalidatePath('/super-admin/ai-credits')
  return { ok: true as const }
}

/** Aplica o valor recomendado (derivado do custo real) como cobrança ao vivo. */
export async function applyRecommendedCreditsCost(actionKey: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const admin = createAdminClient()
  const { data: row } = await admin.from('ai_action_cost_catalog').select('recommended_credits_cost').eq('action_key', actionKey).maybeSingle()
  if (!row?.recommended_credits_cost) return { ok: false as const, error: 'Sem valor recomendado.' }
  return updateActionCostCatalog(actionKey, { credits_cost: row.recommended_credits_cost })
}

// ── Configurações de precificação (câmbio, margem, âncora) ──────────────────

export type AiCreditPricingSettings = {
  usd_to_brl_rate: number
  margin_pct: number
  anchor_action_key: string
  credit_cost_usd_cents: number | null
  credit_cost_brl_cents: number | null
  credit_price_brl_cents: number | null
  updated_at: string
}

export async function getPricingSettings(): Promise<AiCreditPricingSettings | null> {
  if (!(await isSuperAdmin())) return null
  const admin = createAdminClient()
  const { data } = await admin.from('ai_credit_pricing_settings').select('*').eq('id', 1).maybeSingle()
  return data as AiCreditPricingSettings | null
}

export async function updatePricingSettings(input: { usd_to_brl_rate?: number; margin_pct?: number; anchor_action_key?: string }) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const admin = createAdminClient()
  const patch: Record<string, unknown> = {}
  if (input.usd_to_brl_rate !== undefined) patch.usd_to_brl_rate = input.usd_to_brl_rate
  if (input.margin_pct !== undefined) patch.margin_pct = input.margin_pct
  if (input.anchor_action_key !== undefined) patch.anchor_action_key = input.anchor_action_key

  const { error } = await admin.from('ai_credit_pricing_settings').update(patch).eq('id', 1)
  if (error) return { ok: false as const, error: error.message }
  await recomputePricingSettings()
  revalidatePath('/super-admin/ai-credits')
  return { ok: true as const }
}

/** Recalcula credit_cost_usd_cents/credit_cost_brl_cents/credit_price_brl_cents a partir da ação-âncora. */
async function recomputePricingSettings() {
  const admin = createAdminClient()
  const { data: settings } = await admin.from('ai_credit_pricing_settings').select('*').eq('id', 1).maybeSingle()
  if (!settings) return
  const { data: anchor } = await admin
    .from('ai_action_cost_catalog')
    .select('avg_cost_usd_cents, credits_cost')
    .eq('action_key', settings.anchor_action_key)
    .maybeSingle()
  if (!anchor) return

  const costPerCredit = anchor.avg_cost_usd_cents / Math.max(anchor.credits_cost, 1)
  const costBrl = costPerCredit * settings.usd_to_brl_rate
  const priceBrl = costBrl * (1 + settings.margin_pct / 100)

  await admin.from('ai_credit_pricing_settings').update({
    credit_cost_usd_cents: costPerCredit,
    credit_cost_brl_cents: costBrl,
    credit_price_brl_cents: priceBrl,
  }).eq('id', 1)
}

// ── Proposta de créditos por plano ───────────────────────────────────────────

export type PlanCreditProposal = {
  planId: PlanId
  planName: string
  priceMonthlyCents: number
  currentCreditsMonthly: number
  costAtCurrentCreditsBrlCents: number // custo real pra Althos de dar esses créditos
  saleValueAtCurrentCreditsBrlCents: number // valor de venda equivalente (créditos × preço com margem)
}

export async function getPlanCreditProposal(): Promise<{ settings: AiCreditPricingSettings | null; plans: PlanCreditProposal[] }> {
  if (!(await isSuperAdmin())) return { settings: null, plans: [] }
  const admin = createAdminClient()
  const settings = await getPricingSettings()
  const { data: plans } = await admin.from('plans').select('id, name, price_monthly_cents, ai_credits_monthly').order('price_monthly_cents')

  const costPerCredit = settings?.credit_cost_brl_cents || 0
  const pricePerCredit = settings?.credit_price_brl_cents || 0

  const proposals: PlanCreditProposal[] = (plans || []).map((p: any) => ({
    planId: p.id,
    planName: p.name,
    priceMonthlyCents: p.price_monthly_cents,
    currentCreditsMonthly: p.ai_credits_monthly,
    costAtCurrentCreditsBrlCents: Math.round(p.ai_credits_monthly * costPerCredit),
    saleValueAtCurrentCreditsBrlCents: Math.round(p.ai_credits_monthly * pricePerCredit),
  }))

  return { settings, plans: proposals }
}

/** Grava a nova cota mensal de créditos de um plano — efeito AO VIVO em produção. */
export async function applyPlanCredits(planId: PlanId, newCreditsMonthly: number) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  if (newCreditsMonthly < 0) return { ok: false as const, error: 'Quantidade inválida.' }
  const admin = createAdminClient()
  const { error } = await admin.from('plans').update({ ai_credits_monthly: newCreditsMonthly }).eq('id', planId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/super-admin/ai-credits')
  return { ok: true as const }
}

// ── Pacotes de créditos avulsos (compra pelo header do app) ──────────────────

export type CreditPackOption = {
  credits: number
  priceBrlCents: number
}

/** Pacotes calculados a partir do preço vigente do crédito (com margem de 25%). Sem tabela de desconto por volume — margem uniforme. */
export async function getPublicCreditPackOptions(): Promise<{ pricePerCreditBrlCents: number; packs: CreditPackOption[] }> {
  const admin = createAdminClient()
  const { data } = await admin.from('ai_credit_pricing_settings').select('credit_price_brl_cents').eq('id', 1).maybeSingle()
  const price = data?.credit_price_brl_cents || 0
  const sizes = [100, 300, 1000]
  return {
    pricePerCreditBrlCents: price,
    packs: sizes.map(credits => ({ credits, priceBrlCents: Math.round(credits * price) })),
  }
}
