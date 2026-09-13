'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { asaas } from '@/lib/asaas/client'
import { revalidatePath } from 'next/cache'

/**
 * Start a paid subscription checkout via Asaas.
 *
 * Flow:
 *   1. Ensure org has an Asaas customer (create if missing)
 *   2. Create a monthly subscription in Asaas
 *   3. Fetch the first payment to get its invoice URL
 *   4. Return the URL so the client can redirect the user to Asaas to pay
 *
 * On successful payment Asaas fires our webhook which activates the plan.
 */
export async function createCheckoutSession(
  orgSlug: string,
  plan: 'starter' | 'pro' | 'business',
  billingType: 'PIX' | 'CREDIT_CARD' = 'PIX',
  cycle: 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY' = 'MONTHLY',
): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  await requireAuth()
  const org     = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (org.account_type !== 'self_signup') {
    return { ok: false, error: 'Esta conta não pode fazer assinaturas diretas.' }
  }

  try {
    // 1. Find or create Asaas customer
    let customerId = org.asaas_customer_id as string | null | undefined

    if (!customerId) {
      const { data: { user } } = await supabase.auth.getUser()
      const customer = await asaas.createCustomer({
        name:              org.name,
        email:             user?.email || '',
        externalReference: org.id,
      })
      customerId = customer.id as string

      await supabase
        .from('organizations')
        .update({ asaas_customer_id: customerId })
        .eq('id', org.id)
    }

    // 2. Create subscription (monthly or yearly) with the chosen billing method
    const subscription = await asaas.createSubscription(customerId, plan, billingType, cycle)

    await supabase
      .from('organizations')
      .update({
        asaas_subscription_id: subscription.id,
        plan,
        subscription_status:   'trialing', // becomes 'active' after first payment
      })
      .eq('id', org.id)

    // 3. Get first payment → invoice URL
    const payments   = await asaas.getSubscriptionPayments(subscription.id)
    const firstPay   = (payments?.data as any[])?.[0]
    const checkoutUrl: string =
      firstPay?.invoiceUrl  ||
      firstPay?.bankSlipUrl ||
      subscription.invoiceUrl ||
      `https://asaas.com` // ultimate fallback

    revalidatePath(`/app/${orgSlug}/assinatura`)
    return { ok: true, checkoutUrl }
  } catch (err: any) {
    console.error('[createCheckoutSession]', err?.message)
    return { ok: false, error: err.message || 'Erro ao iniciar assinatura' }
  }
}

/**
 * Called after a successful Asaas webhook payment to activate the plan.
 * Uses admin client — called from the webhook route handler only.
 */
export async function activatePlanFromWebhook(
  subscriptionId: string,
  planKey: string,
) {
  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()

  // All paid plans now have unlimited leads.
  // Differentiation is on features (AI, automations, users, API), not lead count.
  // Valores da franquia incluída (repricing set/2026, migration 0244) —
  // manter em sincronia com lib/billing/plans-data.ts PLANS.*.maxUsers.
  const userLimits: Record<string, number | null> = {
    starter:  2,
    pro:      5,
    business: null, // unlimited (sem teto rígido — extras negociados/cobrados à parte)
    scale:    null, // legacy alias of business
  }

  // trial_ends_at reaproveitado (migration 0250): pra quem já pagou, deixa de
  // significar "fim do acesso grátis" e passa a significar "até quando a
  // conta é elegível a reembolso automático de 14 dias" — ver
  // cancelSubscriptionWithRefund() abaixo.
  const refundEligibleUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await admin
    .from('organizations')
    .update({
      plan:                planKey,
      subscription_status: 'active',
      activated_at:        new Date().toISOString(),
      limit_leads:         null,                          // unlimited for all paid plans
      limit_users:         userLimits[planKey] ?? 1,
      trial_ends_at:       refundEligibleUntil,
    })
    .eq('asaas_subscription_id', subscriptionId)

  if (error) {
    console.error('[activatePlanFromWebhook]', error.message)
    return { ok: false as const }
  }
  return { ok: true as const }
}

/**
 * Cancel the org's active Asaas subscription.
 * Sets subscription_status = 'canceled' locally after calling Asaas.
 */
export async function cancelSubscription(
  orgSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth()
  const org     = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const subscriptionId = (org as any).asaas_subscription_id as string | null | undefined
  if (!subscriptionId) {
    return { ok: false, error: 'Nenhuma assinatura ativa encontrada.' }
  }

  try {
    await asaas.cancelSubscription(subscriptionId)
  } catch (err: any) {
    console.error('[cancelSubscription]', err?.message)
    return { ok: false, error: err.message || 'Erro ao cancelar assinatura' }
  }

  await supabase
    .from('organizations')
    .update({ subscription_status: 'canceled' })
    .eq('id', org.id)

  revalidatePath(`/app/${orgSlug}/assinatura`)
  return { ok: true }
}

/**
 * Garantia de reembolso de 14 dias: cancela a assinatura E estorna o
 * pagamento mais recente confirmado, SE a conta ainda estiver dentro da
 * janela (org.trial_ends_at, reaproveitado com esse significado após o
 * primeiro pagamento — ver activatePlanFromWebhook). Fora da janela, cai
 * pro cancelamento normal (sem estorno) — a assinatura para de renovar, mas
 * o que já foi cobrado não é devolvido.
 */
export async function cancelSubscriptionWithRefund(
  orgSlug: string,
): Promise<{ ok: boolean; refunded: boolean; error?: string }> {
  await requireAuth()
  const org      = await getCurrentOrganization(orgSlug) as any
  const supabase = createClient()

  const subscriptionId = org.asaas_subscription_id as string | null | undefined
  if (!subscriptionId) {
    return { ok: false, refunded: false, error: 'Nenhuma assinatura ativa encontrada.' }
  }

  const refundWindowEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null
  const withinRefundWindow = refundWindowEnd !== null && refundWindowEnd.getTime() > Date.now() && org.subscription_status !== 'trial'

  let refunded = false

  try {
    if (withinRefundWindow) {
      const payments = await asaas.getSubscriptionAllPayments(subscriptionId)
      const paidPayment = ((payments?.data as any[]) ?? []).find(
        (p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED',
      )
      if (paidPayment) {
        await asaas.refundPayment(paidPayment.id, 'Cancelamento dentro da garantia de 14 dias')
        refunded = true
      }
    }

    await asaas.cancelSubscription(subscriptionId)
  } catch (err: any) {
    console.error('[cancelSubscriptionWithRefund]', err?.message)
    return { ok: false, refunded: false, error: err.message || 'Erro ao cancelar/estornar assinatura' }
  }

  await supabase
    .from('organizations')
    .update({
      subscription_status: 'canceled',
      ...(refunded ? { refunded_at: new Date().toISOString() } : {}),
    })
    .eq('id', org.id)

  revalidatePath(`/app/${orgSlug}/assinatura`)
  return { ok: true, refunded }
}

export async function getOrgUsage(orgId: string) {
  const supabase = createClient()

  const { count: leadCount } = await supabase
    .from('contatos')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  const { data: usage } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('organization_id', orgId)
    .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    .maybeSingle()

  const { count: memberCount } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  return {
    leads:    leadCount    || 0,
    whatsapp: usage?.whatsapp_count || 0,
    email:    usage?.email_count    || 0,
    users:    memberCount  || 0,
  }
}
