/**
 * WhatsApp Embedded Signup — fluxo por REDIRECIONAMENTO (não popup+SDK).
 *
 * Depois de muita depuração, ficou claro que o fluxo via `FB.login()` (popup +
 * SDK JS + postMessage) não entrega o `code`/evento de finalização de forma
 * confiável neste app — o popup completa visualmente (inclusive reconhecendo
 * a WABA existente), mas o canal de volta pra página nunca chega. Só o
 * redirecionamento direto pra `business.facebook.com/messaging/whatsapp/onboard/`
 * (testado manualmente) completou com "Sua conta foi compartilhada com
 * sucesso" — então o fluxo inteiro foi reescrito em cima dessa URL, com
 * descoberta da WABA/número via Graph API depois da troca do code (em vez de
 * depender do postMessage pro phone_number_id/waba_id).
 *
 * Reaproveita o mesmo App usado por WhatsApp Cloud API/CAPI/Ads
 * (META_APP_ID/META_APP_SECRET).
 */

import { createHmac } from 'crypto'

const GRAPH_VERSION = 'v26.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

export function isEmbeddedSignupConfigured(): boolean {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.NEXT_PUBLIC_META_CONFIG_ID)
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.althoscrm.com.br'
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/whatsapp/embedded-signup/callback`
}

function stateSecret(): string {
  return process.env.META_APP_SECRET || 'dev-secret'
}

// ── CSRF state (assinado, sem sessão de servidor) ────────────────────────────

export function signState(payload: { orgSlug: string; ts: number }): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(raw).digest('base64url')
  return `${raw}.${sig}`
}

export function verifyState(state: string): { orgSlug: string; ts: number } | null {
  const [raw, sig] = state.split('.')
  if (!raw || !sig) return null
  const expected = createHmac('sha256', stateSecret()).update(raw).digest('base64url')
  if (expected !== sig) return null
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (Date.now() - payload.ts > 15 * 60_000) return null // 15 min
    return payload
  } catch {
    return null
  }
}

// ── Fluxo ──────────────────────────────────────────────────────────────────

export function buildEmbeddedSignupUrl(orgSlug: string): string {
  const state = signState({ orgSlug, ts: Date.now() })
  const extras = JSON.stringify({
    version: 'v4',
    sessionInfoVersion: '3',
    featureType: 'whatsapp_business_app_onboarding',
  })
  const params = new URLSearchParams({
    app_id: process.env.META_APP_ID!,
    config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID!,
    extras,
    redirect_uri: redirectUri(),
    state,
  })
  return `https://business.facebook.com/messaging/whatsapp/onboard/?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri(),
    code,
  })
  const res = await fetch(`${GRAPH}/oauth/access_token?${params.toString()}`)
  const json = await res.json()
  if (!res.ok || !json.access_token) throw new Error(json.error?.message || 'Falha ao trocar code por token.')
  return json.access_token as string
}

/**
 * Descobre a WABA e o número de telefone que acabaram de ser compartilhados
 * — em vez de depender do postMessage do popup (que nunca chegou nos
 * nossos testes), busca via Graph API logo após a troca do code.
 */
export async function discoverWabaAndPhone(accessToken: string): Promise<{ wabaId: string; phoneNumberId: string }> {
  const bizRes = await fetch(`${GRAPH}/me/businesses?fields=id,name&access_token=${accessToken}`)
  const bizJson = await bizRes.json()
  if (!bizRes.ok) throw new Error(bizJson.error?.message || 'Falha ao listar negócios do usuário.')
  const businesses = (bizJson.data || []) as { id: string }[]
  if (businesses.length === 0) throw new Error('Nenhum negócio encontrado para essa conta.')

  for (const biz of businesses) {
    const wabaRes = await fetch(`${GRAPH}/${biz.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`)
    const wabaJson = await wabaRes.json()
    if (!wabaRes.ok) continue
    const wabas = (wabaJson.data || []) as { id: string }[]
    if (wabas.length === 0) continue

    const waba = wabas[0]
    const phoneRes = await fetch(`${GRAPH}/${waba.id}/phone_numbers?access_token=${accessToken}`)
    const phoneJson = await phoneRes.json()
    if (!phoneRes.ok) continue
    const phones = (phoneJson.data || []) as { id: string }[]
    if (phones.length === 0) continue

    return { wabaId: waba.id, phoneNumberId: phones[0].id }
  }

  throw new Error('Não encontramos nenhuma WABA com número de telefone compartilhada com o app.')
}

export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Falha ao assinar o webhook da conta.')
  }
}

export async function getPhoneDisplayInfo(phoneNumberId: string, accessToken: string): Promise<{ displayPhone: string | null; verifiedName: string | null }> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = await res.json()
    if (!res.ok) return { displayPhone: null, verifiedName: null }
    return { displayPhone: json.display_phone_number ?? null, verifiedName: json.verified_name ?? null }
  } catch {
    return { displayPhone: null, verifiedName: null }
  }
}
