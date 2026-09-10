import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

/** Webhook de SMS recebido — registra em sms_messages + timeline do contato. */
export async function POST(req: Request) {
  const rawBody = await req.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))
  const { From: fromNumber, To: toNumber, Body: body, MessageSid: messageSid } = params
  if (!fromNumber || !toNumber) return new NextResponse('Bad Request', { status: 400 })

  const admin = createAdminClient()
  const { data: number } = await admin.from('voice_numbers').select('organization_id').eq('e164_number', toNumber).eq('status', 'active').maybeSingle()
  if (!number) return new NextResponse('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })

  const valid = await verifyTwilioSignature(number.organization_id, req.url, params, req.headers.get('X-Twilio-Signature'))
  if (!valid) return new NextResponse('Forbidden', { status: 403 })

  const { error: dupeError } = await admin.from('voice_provider_events').insert({
    organization_id: number.organization_id, provider: 'twilio', event_type: 'sms.received', provider_event_id: messageSid, payload: params,
  })
  if (dupeError) return new NextResponse('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })

  const { data: contato } = await admin.from('contatos').select('id').eq('organization_id', number.organization_id).eq('phone', fromNumber).maybeSingle()

  await admin.from('sms_messages').insert({
    organization_id: number.organization_id, contato_id: contato?.id ?? null, direction: 'inbound',
    from_number: fromNumber, to_number: toNumber, body: body ?? '', provider_message_id: messageSid, status: 'received',
  })

  if (contato) {
    await admin.from('contato_activities').insert({
      organization_id: number.organization_id, contato_id: contato.id, type: 'sms_received', payload: { text: body ?? '' },
    })
    await inngest.send({ name: 'sms.received', data: { orgId: number.organization_id, leadId: contato.id, body } })
  }

  return new NextResponse('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
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
