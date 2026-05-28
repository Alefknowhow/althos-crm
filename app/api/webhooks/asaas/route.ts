import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyStaticToken } from '@/lib/security/webhook'

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

  // Persist raw event first (idempotent audit trail).
  const { data: event, error: insertErr } = await adminSupabase
    .from('billing_events')
    .insert({ event_type: payload.event, payload })
    .select()
    .single()

  if (insertErr) {
    console.error('[asaas webhook] failed to persist event:', insertErr.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  try {
    const subscriptionId: string | undefined =
      payload.payment?.subscription || payload.subscription?.id

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
          const planKey = org.plan === 'starter' || org.plan === 'pro' ? org.plan : 'starter'
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
