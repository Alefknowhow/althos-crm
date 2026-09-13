/**
 * Server-only Althos Voice Credits helpers — mirror de lib/plans/server.ts
 * (consumeAiCredits/getAiCreditsStatus), mas em ledger SEPARADO
 * (voice_credits/voice_credit_transactions) e valores em CENTAVOS (não
 * créditos inteiros). Nunca compartilha saldo com os créditos de IA.
 *
 * DO NOT import from Client Components — usa next/headers via o client
 * server do Supabase.
 */

import { createClient } from '@/lib/supabase/server'
import { getAccountIdForOrgSlug } from '@/lib/plans/server'
import { getVoiceMarkupPct } from './pricing'

export type VoiceUsageType = 'call_human' | 'call_ai' | 'sms' | 'number_rental'

export type ConsumeVoiceResult =
  | { success: true; althosCostCents: number; remainingCents: number; transactionId: string | null; idempotentReplay?: boolean }
  | { success: false; error: string; availableCents?: number }

/**
 * Debita o custo (com markup) de um uso do Voice contra o saldo corrente da
 * conta. Chama a função SQL race-safe `consume_voice_credits` (SELECT ...
 * FOR UPDATE), que também aplica os limites de segurança configurados pela
 * organização (voice_accounts.limits).
 *
 * `idempotencyKey` (migration 0245) — OBRIGATÓRIO para qualquer chamada
 * originada de um job Inngest sujeito a retry (voice-calls, voice-sms): sem
 * ela, um retry de `step.run` reexecuta a função inteira e debita de novo.
 * Convenção: `buildVoiceIdempotencyKey(usageType, refId)`.
 */
export async function consumeVoiceCredits(opts: {
  accountId: string
  organizationId: string
  usageType: VoiceUsageType
  providerCostCents: number
  voiceCallId?: string | null
  metadata?: Record<string, unknown>
  idempotencyKey?: string
}): Promise<ConsumeVoiceResult> {
  const { accountId, organizationId, usageType, providerCostCents, voiceCallId = null, metadata = {}, idempotencyKey = null } = opts
  const markupPct = await getVoiceMarkupPct()

  const supabase = createClient()
  const { data, error } = await supabase.rpc('consume_voice_credits', {
    p_account_id: accountId,
    p_organization_id: organizationId,
    p_usage_type: usageType,
    p_provider_cost_cents: Math.round(providerCostCents),
    p_markup_pct: markupPct,
    p_voice_call_id: voiceCallId,
    p_metadata: metadata,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error('[voice] consumeVoiceCredits error:', error.message)
    return { success: false, error: 'rpc_error' }
  }

  const res = (data ?? {}) as { success?: boolean; althos_cost_cents?: number; remaining_cents?: number; error?: string; available_cents?: number; transaction_id?: string; idempotent_replay?: boolean }
  if (res.success) {
    return {
      success: true,
      althosCostCents: res.althos_cost_cents ?? 0,
      remainingCents: res.remaining_cents ?? 0,
      transactionId: res.transaction_id ?? null,
      idempotentReplay: res.idempotent_replay,
    }
  }
  return { success: false, error: res.error ?? 'insufficient_credits', availableCents: res.available_cents }
}

/**
 * Estorna uma transação de consumo do Voice Credits — usar quando o
 * provider (Twilio) falha DEPOIS do débito (a chamada não completou / o SMS
 * não foi enviado). Idempotente por transação (1 estorno cada).
 */
export async function refundVoiceCredits(transactionId: string, reason?: string): Promise<{ success: boolean; refundedCents?: number; error?: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('refund_voice_credits', {
    p_transaction_id: transactionId,
    p_reason: reason ?? null,
  })
  if (error) {
    console.error('[voice] refundVoiceCredits error:', error.message)
    return { success: false, error: 'rpc_error' }
  }
  const res = (data ?? {}) as { success?: boolean; refunded_cents?: number; error?: string }
  return { success: res.success === true, refundedCents: res.refunded_cents, error: res.error }
}

/**
 * Convenção de chave de idempotência para consumo de Voice/SMS originado de
 * jobs assíncronos — o MESMO evento reprocessado gera a MESMA chave.
 */
export function buildVoiceIdempotencyKey(usageType: VoiceUsageType, refId: string): string {
  return `voice:${usageType}:${refId}`
}

export interface VoiceCreditsStatus {
  periodMonth: string
  includedCents: number
  purchasedCents: number
  usedCents: number
  availableCents: number
}

/** Saldo corrente (centavos) do período atual — cria vazio se ainda não existir. */
export async function getVoiceCreditsStatus(accountId: string): Promise<VoiceCreditsStatus> {
  const supabase = createClient()
  const periodMonth = currentPeriodMonth()

  const { data } = await supabase
    .from('voice_credits')
    .select('period_month, credits_included_cents, credits_purchased_cents, credits_used_cents')
    .eq('account_id', accountId)
    .eq('period_month', periodMonth)
    .maybeSingle()

  if (data) {
    const included = data.credits_included_cents ?? 0
    const purchased = data.credits_purchased_cents ?? 0
    const used = data.credits_used_cents ?? 0
    return {
      periodMonth,
      includedCents: included,
      purchasedCents: purchased,
      usedCents: used,
      availableCents: Math.max(0, included + purchased - used),
    }
  }

  return { periodMonth, includedCents: 0, purchasedCents: 0, usedCents: 0, availableCents: 0 }
}

export async function getVoiceCreditsStatusByOrgSlug(orgSlug: string): Promise<VoiceCreditsStatus | null> {
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return null
  return getVoiceCreditsStatus(accountId)
}

/** Period key: 'YYYY-MM' (UTC) — mesma convenção de lib/plans/server.ts::currentPeriodMonth. */
export function currentPeriodMonth(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
