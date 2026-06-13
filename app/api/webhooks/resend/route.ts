import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyResendWebhook } from '@/lib/security/webhook'

export async function POST(req: Request) {
  try {
    // Read body as text FIRST so we can verify the HMAC before parsing JSON.
    // Calling req.json() consumes the body stream; there is no going back.
    const rawBody = await req.text()

    const verification = verifyResendWebhook(rawBody, req.headers)
    if (!verification.ok) {
      console.warn('[resend webhook] rejected:', verification.reason)
      // Return 200 to Resend so it doesn't keep retrying a legitimately
      // misconfigured request. Change to 403 once RESEND_WEBHOOK_SECRET
      // is confirmed working in production.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)

    if (!payload.type || !payload.data?.email_id) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const emailId = payload.data.email_id

    const { data: emailSend } = await supabase
      .from('email_sends')
      .select('*')
      .eq('resend_id', emailId)
      .single()

    if (emailSend) {
      let newStatus = emailSend.status
      let activityType: string | null = null

      if (payload.type === 'email.delivered') {
        newStatus = 'delivered'
      } else if (payload.type === 'email.opened') {
        newStatus = 'opened'
        activityType = 'email_opened'
      } else if (payload.type === 'email.bounced') {
        newStatus = 'bounced'
        activityType = 'email_bounced'
      } else if (payload.type === 'email.complained') {
        newStatus = 'complained'
        activityType = 'email_complained'
      }

      if (newStatus !== emailSend.status) {
        await supabase
          .from('email_sends')
          .update({ status: newStatus })
          .eq('id', emailSend.id)
      }

      if (activityType) {
        await supabase.from('contato_activities').insert({
          contato_id: emailSend.contato_id,
          organization_id: emailSend.organization_id,
          type: activityType,
          payload: { resend_id: emailId, event: payload.type },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[resend webhook] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
