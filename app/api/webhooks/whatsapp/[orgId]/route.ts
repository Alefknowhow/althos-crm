import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[whatsapp webhook] META_WEBHOOK_VERIFY_TOKEN not set')
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw body.
 * Returns true if META_APP_SECRET is unset (fail-open) so the webhook keeps
 * working until the secret is configured — at which point it becomes mandatory.
 * The fail-open path logs a warning so it can't go unnoticed in production.
 */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.warn('[whatsapp webhook] META_APP_SECRET not set — incoming payloads are NOT being verified')
    return true
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false

  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  try {
    // We need the RAW body to validate the HMAC signature, then parse manually.
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    if (!verifySignature(rawBody, signature)) {
      console.warn('[whatsapp webhook] invalid signature')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const payload = JSON.parse(rawBody)
    const supabase = createAdminClient()

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true })
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          for (const msg of change.value.messages) {
            const phone = msg.from
            const contactName = change.value.contacts?.[0]?.profile?.name || phone

            // Idempotency: drop duplicates by Meta's message id before doing any work.
            // Webhooks can be re-delivered, and without this the conversation
            // unread_count and lead_activities would double-count on retries.
            const { data: existing } = await supabase
              .from('whatsapp_messages')
              .select('id')
              .eq('meta_message_id', msg.id)
              .maybeSingle()
            if (existing) continue

            let { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('organization_id', params.orgId).eq('contact_phone', phone).single()

            let leadId = conv?.lead_id

            if (!leadId) {
              const { data: leads } = await supabase.from('leads').select('id').eq('organization_id', params.orgId).eq('phone', phone).limit(1)
              if (leads && leads.length > 0) leadId = leads[0].id
            }

            if (!leadId) {
              const { data: defaultPipeline } = await supabase.from('pipelines').select('id').eq('organization_id', params.orgId).eq('is_default', true).single()
              let stageId = null
              if (defaultPipeline) {
                const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', defaultPipeline.id).order('position').limit(1).single()
                stageId = stage?.id
              }

              const { data: newLead } = await supabase.from('leads').insert({
                organization_id: params.orgId,
                name: contactName,
                phone: phone,
                source: 'whatsapp',
                pipeline_id: defaultPipeline?.id,
                stage_id: stageId
              }).select('id').single()
              if (newLead) leadId = newLead.id
            }

            // Prévia textual da última mensagem para o inbox (modelo WhatsApp Business).
            const preview: string = msg.text?.body || ({
              image: '📷 Foto', audio: '🎤 Áudio', video: '🎬 Vídeo',
              document: '📄 Documento', sticker: 'Figurinha', location: '📍 Localização',
            } as Record<string, string>)[msg.type] || '[Mídia]'

            if (!conv) {
              const { data: newConv } = await supabase.from('whatsapp_conversations').insert({
                organization_id: params.orgId,
                contact_phone: phone,
                contact_name: contactName,
                lead_id: leadId,
                last_message_at: new Date(msg.timestamp * 1000).toISOString(),
                last_message_preview: preview,
                last_message_direction: 'inbound',
                unread_count: 1
              }).select().single()
              conv = newConv
            } else {
              await supabase.from('whatsapp_conversations').update({
                last_message_at: new Date(msg.timestamp * 1000).toISOString(),
                last_message_preview: preview,
                last_message_direction: 'inbound',
                unread_count: (conv.unread_count || 0) + 1,
                lead_id: leadId
              }).eq('id', conv.id)
            }

            await supabase.from('whatsapp_messages').insert({
              conversation_id: conv.id,
              organization_id: params.orgId,
              direction: 'inbound',
              type: msg.type,
              content: msg,
              meta_message_id: msg.id,
              status: 'delivered'
            })

            if (leadId) {
              await supabase.from('lead_activities').insert({
                lead_id: leadId,
                organization_id: params.orgId,
                type: 'whatsapp_received',
                payload: { body: msg.text?.body || '[Mídia]', message_id: msg.id }
              })
            }

            // Fire push notification event (throttled in Inngest to 1/org/2min).
            await inngest.send({
              name: 'whatsapp/message.received',
              data: {
                orgId:       params.orgId,
                contactName,
                messageBody: msg.text?.body || null,
              },
            })
          }
        }

        if (change.value.statuses) {
          for (const status of change.value.statuses) {
            await supabase.from('whatsapp_messages').update({ status: status.status }).eq('meta_message_id', status.id)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('WhatsApp Webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
