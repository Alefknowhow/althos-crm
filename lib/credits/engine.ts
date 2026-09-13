/**
 * Credit Engine — camada central de consumo/estorno/compra de Althos
 * Credits. Nenhum módulo deve chamar `consume_ai_credits`/`refund_ai_credits`
 * (RPCs, migration 0244) diretamente — sempre passar por aqui, para que
 * idempotência, módulo/provider/model e unit economics sejam registrados de
 * forma consistente em todo o app.
 *
 * "Althos Credits" é o nome comercial do que o schema ainda chama de
 * ai_credits/ai_credit_transactions (ver PRICING_ARCHITECTURE.md — a tabela
 * não foi renomeada para não arriscar uma migração destrutiva; o nome
 * comercial vive só na camada de UI/copy).
 *
 * Voice e SMS NÃO passam por este engine — são usage/billing próprios
 * (lib/voice/*, futuro lib/sms/*), por decisão explícita de produto: o
 * cliente nunca vê "minutos de Voice" descontando de "Althos Credits".
 *
 * DO NOT import from Client Components (usa next/headers via o client
 * server do Supabase).
 */

import { createClient } from '@/lib/supabase/server'
import { modelCreditMultiplier, computeCreditCost, type AiAction } from '@/lib/plans/config'
import { resolveActionCreditCost } from '@/lib/plans/pricing'

export type CreditModule =
  | 'ai_attendant'
  | 'instagram_automation'
  | 'lead_scoring'
  | 'ai_insights'
  | 'financial_ai'
  | 'document_extract'
  | 'roteirista'
  | 'qualifier'
  | 'other'

export interface ConsumeCreditsInput {
  accountId: string
  action: AiAction | string
  module: CreditModule
  /** Custo explícito em créditos (pula o catálogo dinâmico). */
  credits?: number
  provider?: 'anthropic' | 'gemini' | 'openai' | 'deepseek' | string
  model?: string | null
  /** Custo real estimado da chamada (tokens × preço do provider), em centavos — para unit economics, nunca exposto ao cliente. */
  internalCostCents?: number
  leadId?: string | null
  userId?: string | null
  metadata?: Record<string, unknown>
  /**
   * Chave de idempotência — OBRIGATÓRIA para qualquer chamada originada de
   * um job assíncrono (Inngest) sujeito a retry. Uma mesma chave nunca
   * debita duas vezes (ver migration 0244, índice único parcial).
   * Convenção sugerida: `${module}:${action}:${eventId ?? leadId ?? requestId}`.
   */
  idempotencyKey?: string
}

export type ConsumeCreditsResult =
  | { success: true; creditsUsed: number; remaining: number | null; idempotentReplay?: boolean }
  | { success: false; error: string; available?: number }

/**
 * Debita Althos Credits para uma ação. Substitui `consumeAiCredits()`
 * (lib/plans/server.ts, mantida como wrapper fino sobre este engine para não
 * exigir reescrever ~30 call sites de IA de uma vez).
 */
export async function consumeCredits(input: ConsumeCreditsInput): Promise<ConsumeCreditsResult> {
  const baseCost = input.credits ?? (await resolveActionCreditCost(input.action))
  const multiplier = modelCreditMultiplier(input.model)
  const cost = computeCreditCost(baseCost, multiplier)

  const supabase = createClient()
  const { data, error } = await supabase.rpc('consume_ai_credits', {
    p_account_id: input.accountId,
    p_action: input.action,
    p_credits: cost,
    p_contato_id: input.leadId ?? null,
    p_metadata: { ...input.metadata, multiplier },
    p_idempotency_key: input.idempotencyKey ?? null,
    p_module: input.module,
    p_provider: input.provider ?? null,
    p_model: input.model ?? null,
    p_internal_cost_cents: input.internalCostCents ?? null,
    p_user_id: input.userId ?? null,
  })

  if (error) {
    console.error('[CreditEngine] consume error:', error.message)
    return { success: false, error: 'rpc_error' }
  }

  const res = (data ?? {}) as { success?: boolean; credits_used?: number; remaining?: number; error?: string; available?: number; idempotent_replay?: boolean }
  if (res.success) {
    return {
      success: true,
      creditsUsed: res.credits_used ?? cost,
      remaining: res.remaining ?? null,
      idempotentReplay: res.idempotent_replay,
    }
  }
  return { success: false, error: res.error ?? 'insufficient_credits', available: res.available }
}

/** Estorna uma transação de consumo (falha após débito — ver seção 23 do pedido: falha depois da chamada). Idempotente por transação. */
export async function refundCredits(transactionId: string, reason?: string): Promise<{ success: boolean; refunded?: number; error?: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('refund_ai_credits', {
    p_transaction_id: transactionId,
    p_reason: reason ?? null,
  })
  if (error) {
    console.error('[CreditEngine] refund error:', error.message)
    return { success: false, error: 'rpc_error' }
  }
  const res = (data ?? {}) as { success?: boolean; refunded?: number; error?: string }
  return { success: res.success === true, refunded: res.refunded, error: res.error }
}

export interface CreditPackage {
  id: string
  credits: number
  priceCents: number
  sortOrder: number
}

/** Catálogo vigente de pacotes de Althos Credits — nunca hardcode em componente. */
export async function getCreditPackagesCatalog(): Promise<CreditPackage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('credit_packages')
    .select('id, credits, price_cents, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    console.error('[CreditEngine] getCreditPackagesCatalog error:', error?.message)
    return []
  }
  return data.map(p => ({ id: p.id, credits: p.credits, priceCents: p.price_cents, sortOrder: p.sort_order }))
}

/**
 * Convenção de chave de idempotência para chamadas originadas de jobs
 * assíncronos (Inngest). Determinística a partir de identificadores estáveis
 * do evento — o MESMO evento reprocessado gera a MESMA chave.
 */
export function buildCreditIdempotencyKey(module: CreditModule, action: string, refId: string): string {
  return `${module}:${action}:${refId}`
}
