import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/server'
import { consumeVoiceCredits } from '@/lib/voice/credits'
import { getAccountIdForOrgSlug } from '@/lib/plans/server'
import { inngest } from '@/lib/inngest/client'

const PER_MINUTE_COST_CENTS = 15
const RESERVED_MINUTES = 1

const STATUS_MAP: Record<string, string> = {
  queued: 'queued', initiated: 'ringing', ringing: 'ringing',
  'in-progress': 'in_progress', completed: 'completed',
  busy: 'no_answer', failed: 'failed', 'no-answer': 'no_answer', canceled: 'canceled',
}

/**
 * Webhook de status de chamada da Twilio (ringing/answered/completed/...).
 * Idempotente por (provider, CallSid+CallStatus) via voice_provider_events —
 * a Twilio pode reenviar o mesmo evento em retry.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const voiceCallId = searchParams.get('voiceCallId')
  const rawBody = await req.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))
  const callSid = params.CallSid
  const callStatus = params.CallStatus
  const eventId = `${callSid}:${callStatus}`

  if (!voiceCallId || !callSid || !callStatus) return new NextResponse('Bad Request', { status: 400 })

  const admin = createAdminClient()
  const { data: call } = await admin.from('voice_calls').select('*, organizations(slug, account_id)').eq('id', voiceCallId).maybeSingle()
  if (!call) return new NextResponse('Not Found', { status: 404 })

  const valid = await verifyTwilioSignature(call.organization_id, req.url, params, req.headers.get('X-Twilio-Signature'))
  if (!valid) return new NextResponse('Forbidden', { status: 403 })

  const { error: dupeError } = await admin.from('voice_provider_events').insert({
    organization_id: call.organization_id, provider: 'twilio', event_type: 'call.status', provider_event_id: eventId, payload: params,
  })
  if (dupeError) return new NextResponse('OK (duplicate)', { status: 200 }) // UNIQUE violation = já processado

  const mappedStatus = STATUS_MAP[callStatus] ?? callStatus
  const durationSeconds = params.CallDuration ? Number(params.CallDuration) : null

  await admin.from('voice_calls').update({
    status: mappedStatus,
    ended_at: ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(callStatus) ? new Date().toISOString() : call.ended_at,
    duration_seconds: durationSeconds ?? call.duration_seconds,
  }).eq('id', voiceCallId)

  if (callStatus === 'completed' && durationSeconds) {
    const accountId = call.organizations?.account_id ?? (await getAccountIdForOrgSlug(call.organizations?.slug ?? ''))
    const billedMinutes = Math.ceil(durationSeconds / 60)
    const extraMinutes = Math.max(0, billedMinutes - RESERVED_MINUTES)
    if (accountId && extraMinutes > 0) {
      await consumeVoiceCredits({
        accountId,
        organizationId: call.organization_id,
        usageType: 'call_human',
        providerCostCents: extraMinutes * PER_MINUTE_COST_CENTS,
        voiceCallId,
        metadata: { reason: 'call_reconcile', durationSeconds },
      })
    }

    await admin.from('contato_activities').insert({
      organization_id: call.organization_id,
      contato_id: call.contato_id,
      type: call.direction === 'inbound' ? 'call_received' : 'call_made',
      payload: { text: `Ligação de ${Math.ceil(durationSeconds / 60)} min`, voice_call_id: voiceCallId, duration_seconds: durationSeconds },
      created_by: call.user_id,
    })

    if (call.contato_id) {
      await inngest.send({ name: 'voice.call.completed', data: { orgId: call.organization_id, leadId: call.contato_id, voiceCallId, durationSeconds } })
      if (call.outcome === 'qualificado') {
        await inngest.send({ name: 'voice.ai.qualified', data: { orgId: call.organization_id, leadId: call.contato_id, voiceCallId } })
      }
    }
  } else if (['busy', 'failed', 'no-answer'].includes(callStatus)) {
    if (call.contato_id) {
      await admin.from('contato_activities').insert({
        organization_id: call.organization_id,
        contato_id: call.contato_id,
        type: 'call_missed',
        payload: { voice_call_id: voiceCallId },
        created_by: call.user_id,
      })
    }
    // Só chamadas disparadas por automação (max_attempts > 1) agendam retry —
    // click-to-call manual nunca redisca sozinho.
    if (call.max_attempts > call.attempt_number) {
      await inngest.send({ name: 'voice/call.retry.requested', data: { voiceCallId, organizationId: call.organization_id } })
    }
  }

  return new NextResponse('OK', { status: 200 })
}

async function verifyTwilioSignature(organizationId: string, url: string, params: Record<string, string>, signature: string | null): Promise<boolean> {
  if (!signature) return false
  const admin = createAdminClient()
  const { data: account } = await admin.from('voice_accounts').select('id').eq('organization_id', organizationId).maybeSingle()
  if (!account) return false
  const { data: creds } = await admin.from('voice_provider_credentials').select('auth_token').eq('voice_account_id', account.id).maybeSingle()
  if (!creds) return false
  return twilio.validateRequest(creds.auth_token, signature, url, params)
}
