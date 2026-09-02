import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

/**
 * Webhook global do WhatsApp — UMA única URL por App da Meta (não dá pra
 * registrar uma URL por org: a Meta só aceita um callback por App).
 *
 * Cada organização conecta seu próprio número via Embedded Signup
 * (actions/whatsapp.ts::connectWhatsappEmbedded), que assina o App nos
 * webhooks da WABA do cliente e salva o phone_number_id em
 * organizations.whatsapp_phone_number_id. Toda mensagem recebida aqui vem
 * com esse mesmo phone_number_id no payload (change.value.metadata), então
 * é isso que usamos pra descobrir de qual organização é a mensagem —
 * a URL não carrega mais o orgId.
 */

export async function GET(req: Request) {
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

/** Verify Meta's X-Hub-Signature-256 header against the raw body (fail-CLOSED
 *  when the secret is unset — um erro de configuração nunca deve virar
 *  endpoint aberto). */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[whatsapp webhook] META_APP_SECRET not set — rejecting payload (fail-closed)')
    return false
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

export async function POST(req: Request) {
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
        // Status de aprovação de template — não tem phone_number_id (é a
        // nível de WABA, não de número), então trata separado antes do
        // resto do loop, que é tudo sobre mensagens/status de mensagem.
        if (change.field === 'message_template_status_update') {
          const templateId: string | undefined = change.value?.message_template_id?.toString()
          const event: string | undefined = change.value?.event
          const reason: string | null = change.value?.reason || null
          if (templateId && event) {
            const status = event === 'APPROVED' ? 'approved' : event === 'REJECTED' ? 'rejected' : event.toLowerCase()
            await supabase
              .from('whatsapp_templates')
              .update({ status, rejected_reason: status === 'rejected' ? reason : null })
              .eq('meta_template_id', templateId)
          }
          continue
        }

        const phoneNumberId: string | undefined = change.value?.metadata?.phone_number_id
        if (!phoneNumberId) continue

        // Resolve qual organização é dona desse número — cada org conecta o
        // seu via Embedded Signup, salvando o phone_number_id na tabela.
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('whatsapp_phone_number_id', phoneNumberId)
          .maybeSingle()
        if (!org) {
          console.warn(`[whatsapp webhook] nenhuma org encontrada pro phone_number_id ${phoneNumberId}`)
          continue
        }
        const orgId = org.id

        if (change.value.messages) {
          // Todo o trabalho pesado (resolver conversa/lead, atribuição de
          // anúncio CTWA, baixar mídia, gravar mensagem) saiu daqui — agora
          // roda em background (lib/inngest/whatsapp-ingest.ts). O webhook só
          // identifica a org e enfileira, pra responder à Meta o mais rápido
          // possível.
          for (const msg of change.value.messages) {
            const contactName = change.value.contacts?.[0]?.profile?.name || msg.from
            await inngest.send({
              name: 'whatsapp/message.raw',
              data: { orgId, phoneNumberId, msg, contactName },
            })
          }
        }

        if (change.value.statuses) {
          for (const status of change.value.statuses) {
            const { data: updatedMsg } = await supabase
              .from('whatsapp_messages')
              .update({ status: status.status })
              .eq('meta_message_id', status.id)
              .select('conversation_id')
              .maybeSingle()
            if (!updatedMsg) continue

            // Só reflete o "tick" na lista se essa for a mensagem de saída
            // mais recente da conversa — evita um status atrasado (relatório
            // fora de ordem) sobrescrever um status mais novo.
            const { data: latestOutbound } = await supabase
              .from('whatsapp_messages')
              .select('meta_message_id')
              .eq('conversation_id', updatedMsg.conversation_id)
              .eq('direction', 'outbound')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (latestOutbound?.meta_message_id === status.id) {
              await supabase
                .from('whatsapp_conversations')
                .update({ last_message_status: status.status })
                .eq('id', updatedMsg.conversation_id)
            }
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
