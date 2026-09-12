'use server'

/**
 * Althos Voice Credits — compra e histórico do ledger. Saldo/consumo em si
 * (getVoiceCreditsStatus/consumeVoiceCredits) vivem em lib/voice/credits.ts
 * (importável por outras actions/Inngest sem passar pela camada 'use server').
 */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug, getAccountIdForOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getVoiceCreditsStatusByOrgSlug, currentPeriodMonth } from '@/lib/voice/credits'
import { asaas } from '@/lib/asaas/client'
import { VOICE_CREDIT_PACKS } from '@/lib/voice/credit-packs'

export async function getVoiceCreditsStatusAction(orgSlug: string) {
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.', status: null }
  const status = await getVoiceCreditsStatusByOrgSlug(orgSlug)
  return { ok: true as const, status }
}

export async function listVoiceLedger(orgSlug: string, limit = 50) {
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.', transactions: [] }
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada.', transactions: [] }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('voice_credit_transactions')
    .select('id, type, usage_type, quantity, provider_cost_cents, althos_cost_cents, balance_after_cents, created_at, voice_call_id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { ok: false as const, error: error.message, transactions: [] }
  return { ok: true as const, transactions: data ?? [] }
}

/** Compra um pacote de Voice Credits via Asaas (PIX). */
export async function purchaseVoiceCredits(orgSlug: string, packId: typeof VOICE_CREDIT_PACKS[number]['id']) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }

  const pack = VOICE_CREDIT_PACKS.find(p => p.id === packId)
  if (!pack) return { ok: false as const, error: 'Pacote inválido.' }
  if (!org.asaas_customer_id) return { ok: false as const, error: 'Cadastro de cobrança não encontrado — acesse Financeiro primeiro.' }

  const payment = await asaas.createPayment(
    org.asaas_customer_id,
    pack.valueReais,
    `Althos Voice Credits — ${pack.label}`,
    `voice_credits:${org.id}:${pack.id}:${Date.now()}`,
    'PIX',
  )

  return { ok: true as const, paymentUrl: (payment as any)?.invoiceUrl as string | undefined }
}

/** Mínimo pra compra de Voice Credits em quantidade personalizada. */
export const MIN_CUSTOM_VOICE_REAIS = 20

/** Mesmo fluxo de purchaseVoiceCredits, mas com valor escolhido pelo
 *  usuário em vez de um pacote fixo. */
export async function purchaseVoiceCreditsCustom(orgSlug: string, valueReais: number) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  if (!Number.isFinite(valueReais) || valueReais < MIN_CUSTOM_VOICE_REAIS) {
    return { ok: false as const, error: `Valor mínimo: R$ ${MIN_CUSTOM_VOICE_REAIS}.` }
  }
  if (!org.asaas_customer_id) return { ok: false as const, error: 'Cadastro de cobrança não encontrado — acesse Financeiro primeiro.' }

  const payment = await asaas.createPayment(
    org.asaas_customer_id,
    valueReais,
    `Althos Voice Credits — R$ ${valueReais.toFixed(2)} (avulso)`,
    `voice_credits:${org.id}:custom-${Math.round(valueReais * 100)}:${Date.now()}`,
    'PIX',
  )

  return { ok: true as const, paymentUrl: (payment as any)?.invoiceUrl as string | undefined }
}

/**
 * Aplica a compra confirmada (chamado pelo webhook do Asaas quando o
 * pagamento é confirmado — mesmo padrão de activatePlanFromWebhook em
 * actions/billing.ts). Insere no ledger como 'purchased', nunca só atualiza
 * um campo de saldo.
 */
export async function applyVoiceCreditsPurchase(accountId: string, valueCents: number, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient()
  const periodMonth = currentPeriodMonth()

  await admin.from('voice_credits').upsert(
    { account_id: accountId, period_month: periodMonth, reset_at: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() },
    { onConflict: 'account_id,period_month', ignoreDuplicates: true },
  )

  const { data: row } = await admin.from('voice_credits').select('id, credits_purchased_cents, credits_included_cents, credits_used_cents').eq('account_id', accountId).eq('period_month', periodMonth).single()
  if (!row) return { ok: false as const, error: 'Não foi possível localizar o saldo da conta.' }

  const newPurchased = (row.credits_purchased_cents ?? 0) + valueCents
  await admin.from('voice_credits').update({ credits_purchased_cents: newPurchased }).eq('id', row.id)

  const balanceAfter = row.credits_included_cents + newPurchased - row.credits_used_cents
  await admin.from('voice_credit_transactions').insert({
    account_id: accountId,
    voice_credits_id: row.id,
    type: 'purchased',
    provider_cost_cents: 0,
    althos_cost_cents: valueCents,
    balance_after_cents: balanceAfter,
    metadata,
  })

  return { ok: true as const }
}
