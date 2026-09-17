/**
 * Verifica o token assinado (HMAC-SHA256) que o Next.js emite em
 * `app/api/sales-coach/realtime-token/route.ts` antes do browser abrir a
 * conexão WebSocket com este serviço. O browser nunca vê a
 * ELEVENLABS_API_KEY nem o SUPABASE_SERVICE_ROLE_KEY — só este token
 * de curta duração, escopado a UMA sessão.
 *
 * Formato: `${base64url(payloadJson)}.${base64url(hmacSha256(payloadJson))}`
 * — mesmo par de segredo (SALES_COACH_REALTIME_SECRET) configurado nos dois
 * lados (Vercel e Railway). Payload nunca é confidencial por si só (não tem
 * segredo dentro) — a assinatura é o que impede forjar sessão/org.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface SalesCoachRealtimeTokenPayload {
  sessionId: string
  organizationId: string
  userId: string
  /** Unix ms de expiração — tokens são de curta duração (ver mint no Next.js, default 5 min). */
  exp: number
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64')
}

export function verifySessionToken(token: string, secret: string): SalesCoachRealtimeTokenPayload | null {
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest()
  let providedSig: Buffer
  try {
    providedSig = base64UrlDecode(sigB64)
  } catch {
    return null
  }
  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    return null
  }

  let payload: SalesCoachRealtimeTokenPayload
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'))
  } catch {
    return null
  }

  if (!payload.sessionId || !payload.organizationId || !payload.userId || !payload.exp) return null
  if (Date.now() > payload.exp) return null

  return payload
}
