import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { processInboundInteraction, type InboundInteraction } from '@/lib/social/engine'

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

/** Validate Meta's X-Hub-Signature-256 (fail-open when the secret is unset). */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.warn('[instagram webhook] META_APP_SECRET not set — payloads are NOT verified')
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
        // Ignore echoes (messages we sent) and read receipts / reactions.
        if (m.message?.is_echo) continue
        if (!m.message?.text || !senderId) continue
        // Skip messages the business account sent to itself.
        if (senderId === igAccountId) continue
        inbounds.push({
          igAccountId,
          kind: 'dm',
          senderId,
          text: m.message.text,
          mid: m.message.mid ?? null,
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

    // Process sequentially; each is independently guarded against failure.
    for (const inbound of inbounds) {
      try {
        await processInboundInteraction(inbound)
      } catch (e: any) {
        console.error('[instagram webhook] processing error:', e?.message)
      }
    }

    // Always 200 quickly so Meta doesn't retry-storm us.
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[instagram webhook] fatal:', e?.message)
    // Still 200 to avoid aggressive retries on malformed payloads.
    return NextResponse.json({ ok: true })
  }
}
