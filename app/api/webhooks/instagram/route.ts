import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import type { InboundInteraction } from '@/lib/social/engine'
import { inngest } from '@/lib/inngest/client'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Instagram webhook.
 *   GET  → subscription verification (hub.challenge)
 *   POST → incoming DMs and comments
 *
 * Configure in Meta App → Webhooks → Instagram:
 *   Callback URL:  https://<your-domain>/api/webhooks/instagram
 *   Verify token:  value of META_WEBHOOK_VERIFY_TOKEN
 *   Fields:        messages, comments, mentions
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[instagram webhook] META_WEBHOOK_VERIFY_TOKEN not set')
    return new NextResponse('Forbidden', { status: 403 })
  }
  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/** Validate Meta's X-Hub-Signature-256 (fail-CLOSED when the secret is unset —
 *  um erro de configuração de env var nunca deve virar endpoint aberto). */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[instagram webhook] no app secret set — rejecting payload (fail-closed)')
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

/** Atualiza o status (entregue/lida) de mensagens de saída por
 *  meta_message_id, e reflete no "tick" da lista (last_message_status) só
 *  quando for de fato a mensagem de saída mais recente da conversa — evita
 *  um relatório de status atrasado sobrescrever um mais novo. */
async function updateSocialMessageStatuses(mids: string[], status: 'delivered' | 'read') {
  const supabase = createAdminClient()
  for (const mid of mids) {
    const { data: updated } = await supabase
      .from('social_messages')
      .update({ status })
      .eq('meta_message_id', mid)
      .select('conversation_id')
      .maybeSingle()
    if (!updated) continue

    const { data: latestOutbound } = await supabase
      .from('social_messages')
      .select('meta_message_id')
      .eq('conversation_id', updated.conversation_id)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestOutbound?.meta_message_id === mid) {
      await supabase.from('social_conversations').update({ last_message_status: status }).eq('id', updated.conversation_id)
    }
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    if (!verifySignature(rawBody, req.headers.get('x-hub-signature-256'))) {
      console.warn('[instagram webhook] invalid signature')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const payload = JSON.parse(rawBody)
    if (payload.object !== 'instagram') {
      return NextResponse.json({ ok: true })
    }

    const inbounds: InboundInteraction[] = []

    for (const entry of payload.entry || []) {
      const igAccountId = String(entry.id)

      // ── Direct messages ──────────────────────────────────────────────
      for (const m of entry.messaging || []) {
        const senderId = m.sender?.id
        const recipientId = m.recipient?.id

        // Confirmação de entrega/leitura — não é uma interação nova, só
        // atualiza o status de uma mensagem já enviada por nós. Processa
        // direto aqui (não precisa passar pelo engine/automação/IA).
        if (m.read?.mid || m.delivery?.mids) {
          updateSocialMessageStatuses(m.read?.mid ? [m.read.mid] : m.delivery.mids, m.read?.mid ? 'read' : 'delivered')
            .catch(e => console.error('[instagram webhook] status update failed:', e?.message))
          continue
        }

        // Ignore echoes (messages we sent) and reactions.
        if (m.message?.is_echo) continue
        // Toque em botão: quick reply chega em message.quick_reply.payload,
        // botão de template chega em m.postback.payload — em ambos os casos
        // tratamos o payload como o texto da mensagem, pra casar com
        // gatilhos/keywords e destravar passos com wait_for_reply.
        const buttonPayload = m.message?.quick_reply?.payload ?? m.postback?.payload
        const text = buttonPayload || m.message?.text || ''
        // Mídia recebida (foto, áudio, vídeo, arquivo) — a Meta manda em
        // message.attachments, sem texto quando não tem legenda.
        const attachment = m.message?.attachments?.[0]
        const attachmentUrl: string | null = attachment?.payload?.url ?? null
        const attachmentType: 'image' | 'audio' | 'video' | 'document' | null =
          attachment?.type === 'image' ? 'image'
          : attachment?.type === 'audio' ? 'audio'
          : attachment?.type === 'video' ? 'video'
          : attachment?.type === 'file' ? 'document'
          : null
        if ((!text && !attachmentUrl) || !senderId) continue
        // Skip messages the business account sent to itself.
        if (senderId === igAccountId) continue
        inbounds.push({
          igAccountId,
          kind: 'dm',
          senderId,
          text,
          mid: m.message?.mid ?? null,
          // Respostas a stories chegam como DM com contexto reply_to.story.
          isStoryReply: !!m.message?.reply_to?.story,
          attachmentUrl,
          attachmentType,
        })
      }

      // ── Comments ─────────────────────────────────────────────────────
      for (const change of entry.changes || []) {
        if (change.field !== 'comments') continue
        const v = change.value || {}
        const fromId = v.from?.id
        // Don't auto-reply to our own comments / replies.
        if (!v.text || !fromId || fromId === igAccountId) continue
        inbounds.push({
          igAccountId,
          kind: 'comment',
          senderId: fromId,
          senderUsername: v.from?.username ?? null,
          text: v.text,
          commentId: v.id ?? null,
          postId: v.media?.id ?? null,
        })
      }
    }

    // Só enfileira — quem processa de verdade (pode chamar IA + Graph API)
    // é o worker do Inngest (lib/inngest/social-inbound.ts), fora do ciclo
    // de resposta que a Meta espera rápido. inngest.send só grava o evento,
    // é rápido e não deveria falhar; se falhar mesmo assim, loga e segue —
    // não vale a pena fazer a Meta reenviar o payload inteiro por isso.
    try {
      await Promise.all(
        inbounds.map(inbound =>
          inngest.send({ name: 'instagram/inbound.received', data: inbound }),
        ),
      )
    } catch (e: any) {
      console.error('[instagram webhook] failed to enqueue:', e?.message)
    }

    // Always 200 quickly so Meta doesn't retry-storm us.
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[instagram webhook] fatal:', e?.message)
    // Still 200 to avoid aggressive retries on malformed payloads.
    return NextResponse.json({ ok: true })
  }
}
