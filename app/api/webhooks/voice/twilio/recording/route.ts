import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

/** Webhook de gravação pronta (recordingStatusCallback da Twilio). */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const voiceCallId = searchParams.get('voiceCallId')
  const rawBody = await req.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))
  const { RecordingSid: recordingSid, RecordingUrl: recordingUrl, RecordingDuration: duration } = params
  if (!voiceCallId || !recordingSid) return new NextResponse('Bad Request', { status: 400 })

  const admin = createAdminClient()
  const { data: call } = await admin.from('voice_calls').select('organization_id').eq('id', voiceCallId).maybeSingle()
  if (!call) return new NextResponse('Not Found', { status: 404 })

  const valid = await verifyTwilioSignature(call.organization_id, req.url, params, req.headers.get('X-Twilio-Signature'))
  if (!valid) return new NextResponse('Forbidden', { status: 403 })

  const { error: dupeError } = await admin.from('voice_provider_events').insert({
    organization_id: call.organization_id, provider: 'twilio', event_type: 'recording.ready', provider_event_id: recordingSid, payload: params,
  })
  if (dupeError) return new NextResponse('OK', { status: 200 })

  const { data: recording } = await admin.from('voice_recordings').insert({
    organization_id: call.organization_id, voice_call_id: voiceCallId,
    provider_recording_sid: recordingSid, url: `${recordingUrl}.mp3`, duration_seconds: duration ? Number(duration) : null,
  }).select('id').single()

  if (recording) {
    await admin.from('voice_calls').update({ recording_id: recording.id }).eq('id', voiceCallId)
    // Pede a transcrição à Twilio (add-on) — o texto chega depois no webhook
    // de transcrição (app/api/webhooks/voice/twilio/transcription/route.ts).
    await inngest.send({ name: 'voice/transcription.requested', data: { voiceCallId, organizationId: call.organization_id, recordingSid } })
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
