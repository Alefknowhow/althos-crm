/**
 * Server-only Email Credits helpers — mirror de lib/voice/credits.ts, mas em
 * ledger SEPARADO (email_credits/email_credit_transactions) e valores em
 * numeric(12,4) "centavos de R$" (fração de centavo — custo real do Resend é
 * sub-centavo por e-mail). Nunca compartilha saldo com créditos de IA/Voice.
 *
 * DO NOT import from Client Components — usa next/headers via o client
 * server do Supabase.
 */

import { createClient } from '@/lib/supabase/server'
import { getAccountIdForOrgSlug } from '@/lib/plans/server'

export type ConsumeEmailResult =
  | { success: true; althosCostCents: number; remainingCents: number }
  | { success: false; error: string; availableCents?: number }

type EmailPricingConfig = { providerCostUsdCentsPer1k: number; usdToBrlRate: number; markupPct: number }

/** Config global de custo/câmbio/markup — 1 linha, editável só por super-admin. */
export async function getEmailPricingConfig(): Promise<EmailPricingConfig> {
  const supabase = createClient()
  const { data } = await supabase
    .from('email_pricing_config')
    .select('provider_cost_usd_cents_per_1k, usd_to_brl_rate, markup_pct')
    .limit(1)
    .maybeSingle()
  return {
    providerCostUsdCentsPer1k: data?.provider_cost_usd_cents_per_1k ?? 90,
    usdToBrlRate: data?.usd_to_brl_rate ?? 5.4,
    markupPct: data?.markup_pct ?? 25,
  }
}

/** Custo do provider (Resend) em centavos de R$ fracionários, POR e-mail. */
export function computeProviderCostCentsPerEmail(config: EmailPricingConfig): number {
  return (config.providerCostUsdCentsPer1k / 1000) * config.usdToBrlRate
}

/**
 * Debita o custo (com markup) de UM e-mail disparado contra o saldo corrente
 * da conta. Chama a função SQL race-safe `consume_email_credits` (SELECT ...
 * FOR UPDATE) — nunca decrementa o saldo direto na aplicação.
 */
export async function consumeEmailCredits(opts: {
  accountId: string
  emailSendId?: string | null
  metadata?: Record<string, unknown>
}): Promise<ConsumeEmailResult> {
  const { accountId, emailSendId = null, metadata = {} } = opts
  const config = await getEmailPricingConfig()
  const providerCostCents = computeProviderCostCentsPerEmail(config)

  const supabase = createClient()
  const { data, error } = await supabase.rpc('consume_email_credits', {
    p_account_id: accountId,
    p_provider_cost_cents: providerCostCents,
    p_markup_pct: config.markupPct,
    p_email_send_id: emailSendId,
    p_metadata: metadata,
  })

  if (error) {
    console.error('[email credits] consumeEmailCredits error:', error.message)
    return { success: false, error: 'rpc_error' }
  }

  const res = (data ?? {}) as { success?: boolean; althos_cost_cents?: number; remaining_cents?: number; error?: string; available_cents?: number }
  if (res.success) {
    return { success: true, althosCostCents: res.althos_cost_cents ?? 0, remainingCents: res.remaining_cents ?? 0 }
  }
  return { success: false, error: res.error ?? 'insufficient_credits', availableCents: res.available_cents }
}

export interface EmailCreditsStatus {
  periodMonth: string
  includedCents: number
  purchasedCents: number
  usedCents: number
  availableCents: number
}

/** Saldo corrente (centavos fracionários) do período atual. */
export async function getEmailCreditsStatus(accountId: string): Promise<EmailCreditsStatus> {
  const supabase = createClient()
  const periodMonth = currentEmailPeriodMonth()

  const { data } = await supabase
    .from('email_credits')
    .select('period_month, credits_included_cents, credits_purchased_cents, credits_used_cents')
    .eq('account_id', accountId)
    .eq('period_month', periodMonth)
    .maybeSingle()

  if (data) {
    const included = Number(data.credits_included_cents ?? 0)
    const purchased = Number(data.credits_purchased_cents ?? 0)
    const used = Number(data.credits_used_cents ?? 0)
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

export async function getEmailCreditsStatusByOrgSlug(orgSlug: string): Promise<EmailCreditsStatus | null> {
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return null
  return getEmailCreditsStatus(accountId)
}

/** Period key: 'YYYY-MM' (UTC) — mesma convenção de lib/plans/server.ts. */
export function currentEmailPeriodMonth(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
