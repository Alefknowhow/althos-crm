'use server'

/**
 * Email Credits — compra e histórico do ledger. Saldo/consumo em si
 * (getEmailCreditsStatus/consumeEmailCredits) vivem em lib/email/credits.ts
 * (importável por lib/inngest/functions.ts sem passar pela camada 'use server').
 */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAccountIdForOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getEmailCreditsStatusByOrgSlug, currentEmailPeriodMonth } from '@/lib/email/credits'
import { asaas } from '@/lib/asaas/client'
import { EMAIL_CREDIT_PACKS } from '@/lib/email/credit-packs'
import { MIN_CUSTOM_EMAIL_REAIS } from '@/lib/billing/credit-minimums'

export async function getEmailCreditsStatusAction(orgSlug: string) {
  await requireAuth()
  const status = await getEmailCreditsStatusByOrgSlug(orgSlug)
  return { ok: true as const, status }
}

export async function listEmailCreditsLedger(orgSlug: string, limit = 50) {
  await requireAuth()
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada.', transactions: [] }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('email_credit_transactions')
    .select('id, type, provider_cost_cents, althos_cost_cents, balance_after_cents, created_at, email_send_id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { ok: false as const, error: error.message, transactions: [] }
  return { ok: true as const, transactions: data ?? [] }
}

/** Compra um pacote de Email Credits via Asaas (PIX). */
export async function purchaseEmailCredits(orgSlug: string, packId: typeof EMAIL_CREDIT_PACKS[number]['id']) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const check = await checkMemberPermission(org.id, user.id, 'settings')
  if (!check.allowed) return { ok: false as const, error: check.reason }

  const pack = EMAIL_CREDIT_PACKS.find(p => p.id === packId)
  if (!pack) return { ok: false as const, error: 'Pacote inválido.' }
  if (!org.asaas_customer_id) return { ok: false as const, error: 'Cadastro de cobrança não encontrado — acesse Financeiro primeiro.' }

  const payment = await asaas.createPayment(
    org.asaas_customer_id,
    pack.valueReais,
    `Althos CRM — Pacote de Email Credits (${pack.label})`,
    `email_credits:${org.id}:${pack.id}:${Date.now()}`,
    'PIX',
  )

  return { ok: true as const, paymentUrl: (payment as any)?.invoiceUrl as string | undefined }
}

/** Mesmo fluxo de purchaseEmailCredits, mas com valor escolhido pelo usuário. */
export async function purchaseEmailCreditsCustom(orgSlug: string, valueReais: number) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const check = await checkMemberPermission(org.id, user.id, 'settings')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  if (!Number.isFinite(valueReais) || valueReais < MIN_CUSTOM_EMAIL_REAIS) {
    return { ok: false as const, error: `Valor mínimo: R$ ${MIN_CUSTOM_EMAIL_REAIS}.` }
  }
  if (!org.asaas_customer_id) return { ok: false as const, error: 'Cadastro de cobrança não encontrado — acesse Financeiro primeiro.' }

  const payment = await asaas.createPayment(
    org.asaas_customer_id,
    valueReais,
    `Althos CRM — Email Credits R$ ${valueReais.toFixed(2)} (avulso)`,
    `email_credits:${org.id}:custom-${Math.round(valueReais * 100)}:${Date.now()}`,
    'PIX',
  )

  return { ok: true as const, paymentUrl: (payment as any)?.invoiceUrl as string | undefined }
}

/**
 * Aplica a compra confirmada (chamado pelo webhook do Asaas quando o
 * pagamento é confirmado). Insere no ledger como 'purchased', nunca só
 * atualiza um campo de saldo.
 */
export async function applyEmailCreditsPurchase(accountId: string, valueCents: number, metadata: Record<string, unknown> = {}) {
  const admin = createAdminClient()
  const periodMonth = currentEmailPeriodMonth()

  await admin.from('email_credits').upsert(
    { account_id: accountId, period_month: periodMonth, reset_at: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() },
    { onConflict: 'account_id,period_month', ignoreDuplicates: true },
  )

  const { data: row } = await admin.from('email_credits').select('id, credits_purchased_cents, credits_included_cents, credits_used_cents').eq('account_id', accountId).eq('period_month', periodMonth).single()
  if (!row) return { ok: false as const, error: 'Não foi possível localizar o saldo da conta.' }

  const newPurchased = Number(row.credits_purchased_cents ?? 0) + valueCents
  await admin.from('email_credits').update({ credits_purchased_cents: newPurchased }).eq('id', row.id)

  const balanceAfter = Number(row.credits_included_cents) + newPurchased - Number(row.credits_used_cents)
  await admin.from('email_credit_transactions').insert({
    account_id: accountId,
    email_credits_id: row.id,
    type: 'purchased',
    provider_cost_cents: 0,
    althos_cost_cents: valueCents,
    balance_after_cents: balanceAfter,
    metadata,
  })

  return { ok: true as const }
}

export async function getEmailCreditPacks() {
  return EMAIL_CREDIT_PACKS
}
