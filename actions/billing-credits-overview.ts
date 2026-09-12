'use server'

/**
 * Visão consolidada dos 3 tipos de crédito (IA, Voice, Email) pro painel de
 * Assinatura — cada um já tem seu próprio ledger/status (lib/plans/server.ts,
 * lib/voice/credits.ts, lib/email/credits.ts), esta action só agrega os 3
 * pra uma única tela sem duplicar a lógica de saldo/consumo de cada um.
 */

import { createClient } from '@/lib/supabase/server'
import { getAccountIdForOrgSlug, getAiCreditsStatus, checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { getVoiceCreditsStatus } from '@/lib/voice/credits'
import { getEmailCreditsStatus } from '@/lib/email/credits'

export type CreditLedgerRow = {
  id: string
  type: string
  detail: string | null
  amount: number // créditos (IA) ou centavos BRL (Voice/Email) — unidade nativa de cada um
  createdAt: string
}

export type CreditsOverview = {
  ai: { available: number; used: number; purchased: number; included: number; transactions: CreditLedgerRow[] }
  voice: { enabled: boolean; availableCents: number; usedCents: number; purchasedCents: number; transactions: CreditLedgerRow[] }
  email: { availableCents: number; usedCents: number; purchasedCents: number; transactions: CreditLedgerRow[] }
}

export async function getCreditsOverview(orgSlug: string): Promise<{ ok: true; overview: CreditsOverview } | { ok: false; error: string }> {
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: false, error: 'Conta não encontrada.' }

  const supabase = createClient()
  const voiceEnabled = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')

  const [aiStatus, voiceStatus, emailStatus, aiTx, voiceTx, emailTx] = await Promise.all([
    getAiCreditsStatus(accountId),
    voiceEnabled ? getVoiceCreditsStatus(accountId) : Promise.resolve(null),
    getEmailCreditsStatus(accountId),
    supabase.from('ai_credit_transactions').select('id, type, action, credits_delta, created_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(10),
    voiceEnabled
      ? supabase.from('voice_credit_transactions').select('id, type, usage_type, althos_cost_cents, created_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('email_credit_transactions').select('id, type, althos_cost_cents, created_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(10),
  ])

  const aiActionLabels: Record<string, string> = {
    ai_attendant_reply: 'Resposta do Atendente IA', lead_scoring: 'Qualificação de lead', ai_insights_query: 'Consulta ao Copiloto',
    generate_proposal: 'Geração de proposta', financial_ai_chat: 'Chat financeiro IA', credit_pack_purchase: 'Compra de créditos',
  }
  const voiceUsageLabels: Record<string, string> = { call_human: 'Ligação', call_ai: 'Voice AI', sms: 'SMS', number_rental: 'Número' }

  return {
    ok: true,
    overview: {
      ai: {
        available: aiStatus.available,
        used: aiStatus.used,
        purchased: aiStatus.purchased,
        included: aiStatus.included,
        transactions: (aiTx.data ?? []).map((t: any) => ({
          id: t.id,
          type: t.type,
          detail: t.type === 'purchased' ? 'Compra de créditos' : (aiActionLabels[t.action] || t.action),
          amount: t.credits_delta,
          createdAt: t.created_at,
        })),
      },
      voice: {
        enabled: voiceEnabled,
        availableCents: voiceStatus?.availableCents ?? 0,
        usedCents: voiceStatus?.usedCents ?? 0,
        purchasedCents: voiceStatus?.purchasedCents ?? 0,
        transactions: ((voiceTx as any).data ?? []).map((t: any) => ({
          id: t.id,
          type: t.type,
          detail: t.type === 'purchased' ? 'Compra de créditos' : (voiceUsageLabels[t.usage_type] || t.usage_type),
          amount: t.althos_cost_cents,
          createdAt: t.created_at,
        })),
      },
      email: {
        availableCents: emailStatus.availableCents,
        usedCents: emailStatus.usedCents,
        purchasedCents: emailStatus.purchasedCents,
        transactions: (emailTx.data ?? []).map((t: any) => ({
          id: t.id,
          type: t.type,
          detail: t.type === 'purchased' ? 'Compra de créditos' : 'Envio de e-mail',
          amount: Number(t.althos_cost_cents),
          createdAt: t.created_at,
        })),
      },
    },
  }
}
