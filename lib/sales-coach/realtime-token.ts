/**
 * Assina o token de curta duração que autoriza o browser a conectar no
 * serviço realtime dedicado (Railway — `services/sales-coach-realtime/`,
 * ver README lá). Mesmo esquema (HMAC-SHA256, `SALES_COACH_REALTIME_SECRET`
 * compartilhado) que `services/sales-coach-realtime/src/session-token.ts`
 * verifica do outro lado — mudar um lado sem o outro quebra a conexão.
 *
 * O token não é confidencial por si (não carrega segredo dentro do
 * payload) — a assinatura é o que impede forjar sessão/org/usuário.
 */
import { createHmac } from 'node:crypto'

const TOKEN_TTL_MS = 5 * 60 * 1000

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function getSalesCoachRealtimeSecret(): string {
  return process.env.SALES_COACH_REALTIME_SECRET || ''
}

export function hasSalesCoachRealtimeSecret(): boolean {
  return getSalesCoachRealtimeSecret().length > 0
}

export function getSalesCoachRealtimeWsUrl(): string {
  return process.env.SALES_COACH_REALTIME_URL || ''
}

export function signSalesCoachRealtimeToken(payload: {
  sessionId: string
  organizationId: string
  userId: string
}): string {
  return signRealtimeToken(payload)
}

/**
 * Chamada assistida (Voice → CallDialerModal, modo "assistida") reaproveita
 * o MESMO serviço/segredo do IA Sales Coach (services/sales-coach-realtime)
 * — é a mesma peça de infra (WebSocket persistente + ElevenLabs Scribe),
 * só com um novo par de rotas (`/twilio-media`, `/assist-chat`) lá dentro
 * para essa finalidade. Ver services/sales-coach-realtime/src/server.ts.
 */
export function signVoiceAssistRealtimeToken(payload: {
  sessionId: string
  organizationId: string
  userId: string
}): string {
  return signRealtimeToken(payload)
}

function signRealtimeToken(payload: { sessionId: string; organizationId: string; userId: string }): string {
  const secret = getSalesCoachRealtimeSecret()
  if (!secret) {
    throw new Error('SALES_COACH_REALTIME_SECRET não configurado neste ambiente.')
  }

  const fullPayload = { ...payload, exp: Date.now() + TOKEN_TTL_MS }
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload))
  const sig = createHmac('sha256', secret).update(payloadB64).digest()
  const sigB64 = base64UrlEncode(sig)
  return `${payloadB64}.${sigB64}`
}
