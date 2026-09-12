import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyStaticToken } from '@/lib/security/webhook'
import { parseCreditPackRef, parseEmailCreditsRef, parseVoiceCreditsRef, resolvePackCents, resolvePlanKeyFromOrg, buildAsaasDedupeKey } from '@/lib/asaas/webhook-helpers'
import { EMAIL_CREDIT_PACKS } from '@/lib/email/credit-packs'
import { VOICE_CREDIT_PACKS } from '@/lib/voice/credit-packs'

export async function POST(req: NextRequest) {
  // Timing-safe token comparison — guards against timing attacks that could
  // reveal the token length or prefix by measuring response latency.
  const verification = verifyStaticToken(
    req.headers.get('asaas-access-token'),
    'ASAAS_WEBHOOK_TOKEN',
  )
  if (!verification.ok) {
    console.warn('[asaas webhook] rejected:', verification.reason)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Read body as text first so we never blindly trust the Content-Type.
  // Asaas sends application/json but we parse manually for safety.
  const rawBody = await req.text()

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Basic shape validation — reject payloads missing the required event field.
  if (typeof payload?.event !== 'string') {
    return NextResponse.json({ error: 'Invalid payload: missing event' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // Idempotência: Asaas reenvia o mesmo evento se o handler não responder 2xx
  // a tempo (timeout). Sem uma chave de dedup, isso credita pacotes avulsos
  // de IA em dobro (achado 1.2 da auditoria de segurança) na reentrega.
  // dedupe_key = event_type + id do payment/subscription do payload — o
  // mesmo evento de verdade sempre carrega o mesmo id.
  const dedupeKey = buildAsaasDedupeKey(payload)

  // Persist raw event first (idempotent audit trail). Conflito de unique
  // index em dedupe_key = já processamos esse evento exato antes.
  const { data: event, error: insertErr } = await adminSupabase
    .from('billing_events')
    .insert({ event_type: payload.event, payload, dedupe_key: dedupeKey })
    .select()
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      console.warn('[asaas webhook] evento duplicado (retry), ignorando:', dedupeKey)
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error('[asaas webhook] failed to persist event:', insertErr.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  try {
    const subscriptionId: string | undefined =
      payload.payment?.subscription || payload.subscription?.id
    const externalRef: string | undefined = payload.payment?.externalReference

    // ── One-off add-on purchases (no subscription attached) ──────────────
    // Créditos de IA avulsos: externalReference = "credit_pack:<accountId>:<credits>"
    const creditPack = !subscriptionId ? parseCreditPackRef(externalRef) : null
    if (creditPack) {
      const ev: string = payload.event
      if (ev === 'PAYMENT_RECEIVED' || ev === 'PAYMENT_CONFIRMED') {
        const { accountId, credits } = creditPack
        const { currentPeriodMonth } = await import('@/lib/plans/server')
        const periodMonth = currentPeriodMonth()

        const { data: existing } = await adminSupabase
          .from('ai_credits')
          .select('id, credits_purchased')
          .eq('account_id', accountId)
          .eq('period_month', periodMonth)
          .maybeSingle()

        // ai_credits_id da linha afetada — usado no insert de purchased
        // logo abaixo, pra manter o ledger com a mesma fonte de verdade que
        // consume_ai_credits (os 'consumed') já usa.
        let aiCreditsId: string | null = null

        if (existing) {
          await adminSupabase
            .from('ai_credits')
            .update({ credits_purchased: (existing.credits_purchased ?? 0) + credits })
            .eq('id', existing.id)
          aiCreditsId = existing.id
        } else {
          const { data: inserted } = await adminSupabase.from('ai_credits').insert({
            account_id: accountId,
            period_month: periodMonth,
            credits_included: 0,
            credits_purchased: credits,
            credits_used: 0,
          }).select('id').single()
          aiCreditsId = inserted?.id ?? null
        }

        // Ledger — antes a compra só atualizava o saldo direto, sem deixar
        // rastro em ai_credit_transactions (histórico de faturas não via
        // essas compras). Mesmo padrão de purchased usado em Voice/Email Credits.
        if (aiCreditsId) {
          await adminSupabase.from('ai_credit_transactions').insert({
            account_id: accountId,
            ai_credits_id: aiCreditsId,
            type: 'purchased',
            action: 'credit_pack_purchase',
            credits_delta: credits,
            metadata: { externalRef },
          })
        }
      }

      await adminSupabase
        .from('billing_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', event.id)

      return NextResponse.json({ ok: true })
    }

    // ── Compra avulsa de Email Credits ────────────────────────────────────
    const emailCreditsRef = !subscriptionId ? parseEmailCreditsRef(externalRef) : null
    if (emailCreditsRef) {
      const ev: string = payload.event
      if (ev === 'PAYMENT_RECEIVED' || ev === 'PAYMENT_CONFIRMED') {
        const cents = resolvePackCents(emailCreditsRef.packId, EMAIL_CREDIT_PACKS)
        const { data: org } = await adminSupabase
          .from('organizations')
          .select('account_id')
          .eq('id', emailCreditsRef.orgId)
          .maybeSingle()
        if (cents && org?.account_id) {
          const { applyEmailCreditsPurchase } = await import('@/actions/email-credits')
          await applyEmailCreditsPurchase(org.account_id, cents, { packId: emailCreditsRef.packId })
        } else {
          console.error('[asaas webhook] email_credits: pacote ou org/account_id não encontrado', emailCreditsRef)
        }
      }

      await adminSupabase
        .from('billing_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', event.id)

      return NextResponse.json({ ok: true })
    }

    // ── Compra avulsa de Voice Credits ─────────────────────────────────────
    const voiceCreditsRef = !subscriptionId ? parseVoiceCreditsRef(externalRef) : null
    if (voiceCreditsRef) {
      const ev: string = payload.event
      if (ev === 'PAYMENT_RECEIVED' || ev === 'PAYMENT_CONFIRMED') {
        const cents = resolvePackCents(voiceCreditsRef.packId, VOICE_CREDIT_PACKS)
        const { data: org } = await adminSupabase
          .from('organizations')
          .select('account_id')
          .eq('id', voiceCreditsRef.orgId)
          .maybeSingle()
        if (cents && org?.account_id) {
          const { applyVoiceCreditsPurchase } = await import('@/actions/voice-credits')
          await applyVoiceCreditsPurchase(org.account_id, cents, { packId: voiceCreditsRef.packId })
        } else {
          console.error('[asaas webhook] voice_credits: pacote ou org/account_id não encontrado', voiceCreditsRef)
        }
      }

      await adminSupabase
        .from('billing_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', event.id)

      return NextResponse.json({ ok: true })
    }

    if (subscriptionId) {
      const { data: org } = await adminSupabase
        .from('organizations')
        .select('id, plan, subscription_status')
        .eq('asaas_subscription_id', subscriptionId)
        .maybeSingle()

      if (org) {
        // ── Determine new subscription_status ──────────────────────────────
        let newStatus = org.subscription_status as string
        const ev: string = payload.event

        if (ev === 'PAYMENT_RECEIVED' || ev === 'PAYMENT_CONFIRMED') {
          // Activate the plan and remove trial limits
          newStatus = 'active'

          // Derive the plan key from the org's current plan column
          // (set when checkout was initiated in createCheckoutSession)
          const planKey = resolvePlanKeyFromOrg(org.plan)
          const { activatePlanFromWebhook } = await import('@/actions/billing')
          await activatePlanFromWebhook(subscriptionId, planKey)
        } else if (ev === 'PAYMENT_OVERDUE') {
          newStatus = 'past_due'
        } else if (ev === 'SUBSCRIPTION_DELETED') {
          newStatus = 'canceled'
        }

        if (newStatus !== 'active') {
          // activatePlanFromWebhook handles 'active' case
          await adminSupabase
            .from('organizations')
            .update({
              subscription_status: newStatus,
              current_period_end:
                payload.payment?.dueDate || payload.subscription?.nextDueDate || null,
            })
            .eq('id', org.id)
        }
      }
    }

    await adminSupabase
      .from('billing_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', event.id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[asaas webhook] processing error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
