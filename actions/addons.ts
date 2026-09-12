'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getAccountIdForOrgSlug } from '@/lib/plans/server'
import { CREDIT_PACKS, ADDON_CREDIT_PRICE_CENTS } from '@/lib/plans/config'
import { asaas } from '@/lib/asaas/client'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { isAccessBlocked } from '@/lib/billing/plans'
import { MIN_CUSTOM_AI_CREDITS } from '@/lib/billing/credit-minimums'
import { revalidatePath } from 'next/cache'

/**
 * Compra avulsa de créditos de IA — self-service via Asaas (pagamento único,
 * não é assinatura). Ao confirmar o pagamento, o webhook
 * (app/api/webhooks/asaas/route.ts) credita `ai_credits.credits_purchased`.
 */
export async function purchaseCreditPack(orgSlug: string, packIndex: number) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  if (isAccessBlocked(org)) {
    return { ok: false as const, error: 'Conta em modo somente leitura. Assine um plano para comprar créditos.' }
  }

  const pack = CREDIT_PACKS[packIndex]
  if (!pack) return { ok: false as const, error: 'Pacote inválido.' }

  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada.' }

  const supabase = createClient()

  try {
    let customerId = org.asaas_customer_id as string | null | undefined
    if (!customerId) {
      const { data: { user } } = await supabase.auth.getUser()
      const customer = await asaas.createCustomer({
        name: org.name,
        email: user?.email || '',
        externalReference: org.id,
      })
      customerId = customer.id as string
      await supabase.from('organizations').update({ asaas_customer_id: customerId }).eq('id', org.id)
    }

    const payment = await asaas.createPayment(
      customerId,
      pack.priceCents / 100,
      `Althos CRM — Pacote de ${pack.credits} créditos de IA`,
      `credit_pack:${accountId}:${pack.credits}`,
    )

    const checkoutUrl: string = payment?.invoiceUrl || payment?.bankSlipUrl || 'https://asaas.com'
    return { ok: true as const, checkoutUrl }
  } catch (err: any) {
    console.error('[purchaseCreditPack]', err?.message)
    return { ok: false as const, error: err.message || 'Erro ao iniciar a compra.' }
  }
}

/**
 * Mesmo fluxo de purchaseCreditPack, mas com quantidade escolhida pelo
 * usuário em vez de um pacote fixo — preço à taxa cheia (sem desconto de
 * volume dos pacotes prontos), ADDON_CREDIT_PRICE_CENTS/crédito.
 */
export async function purchaseCustomCreditPack(orgSlug: string, credits: number) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  if (isAccessBlocked(org)) {
    return { ok: false as const, error: 'Conta em modo somente leitura. Assine um plano para comprar créditos.' }
  }
  if (!Number.isFinite(credits) || credits < MIN_CUSTOM_AI_CREDITS) {
    return { ok: false as const, error: `Quantidade mínima: ${MIN_CUSTOM_AI_CREDITS} créditos.` }
  }

  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada.' }

  const supabase = createClient()
  const priceCents = Math.round(credits * ADDON_CREDIT_PRICE_CENTS)

  try {
    let customerId = org.asaas_customer_id as string | null | undefined
    if (!customerId) {
      const { data: { user } } = await supabase.auth.getUser()
      const customer = await asaas.createCustomer({ name: org.name, email: user?.email || '', externalReference: org.id })
      customerId = customer.id as string
      await supabase.from('organizations').update({ asaas_customer_id: customerId }).eq('id', org.id)
    }

    const payment = await asaas.createPayment(
      customerId,
      priceCents / 100,
      `Althos CRM — ${credits} créditos de IA (avulso)`,
      `credit_pack:${accountId}:${credits}`,
    )

    const checkoutUrl: string = payment?.invoiceUrl || payment?.bankSlipUrl || 'https://asaas.com'
    return { ok: true as const, checkoutUrl }
  } catch (err: any) {
    console.error('[purchaseCustomCreditPack]', err?.message)
    return { ok: false as const, error: err.message || 'Erro ao iniciar a compra.' }
  }
}

const RequestSchema = z.object({
  kind: z.enum(['extra_users', 'extra_orgs', 'niche_module']),
  details: z.record(z.string(), z.any()),
})

/**
 * Usuários extras, lojas/agências extras e módulos de nicho mudam o valor
 * RECORRENTE da assinatura — nesta leva isso é processado manualmente pelo
 * time comercial (não recalculamos a assinatura Asaas automaticamente ainda).
 * Grava a solicitação em `addon_requests` e notifica o suporte por e-mail.
 */
export async function requestAddonChange(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  if (isAccessBlocked(org)) {
    return { ok: false as const, error: 'Conta em modo somente leitura. Assine um plano para solicitar add-ons.' }
  }

  const parsed = RequestSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos.' }
  const { kind, details } = parsed.data

  const admin = createAdminClient()
  const { error } = await admin.from('addon_requests').insert({
    organization_id: org.id,
    requested_by: user.id,
    kind,
    details,
  })
  if (error) return { ok: false as const, error: 'Erro ao registrar a solicitação.' }

  const kindLabel = kind === 'extra_users' ? 'Usuários extras' : kind === 'extra_orgs' ? 'Lojas/agências extras' : 'Módulo de nicho'
  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to: 'suporte@althoscrm.com.br',
      subject: `Solicitação de add-on — ${kindLabel} — ${org.name}`,
      text: [
        `Organização: ${org.name} (${orgSlug})`,
        `Solicitado por: ${user.email}`,
        `Tipo: ${kindLabel}`,
        `Detalhes: ${JSON.stringify(details)}`,
      ].join('\n'),
    })
  } catch (e) {
    console.error('requestAddonChange: falha ao notificar por e-mail', e)
  }

  revalidatePath(`/app/${orgSlug}/assinatura`)
  return { ok: true as const }
}

/** Créditos disponíveis pro mês corrente — usado pra exibir "já comprou" no cliente. */
export async function getCreditPacks() {
  return CREDIT_PACKS
}
