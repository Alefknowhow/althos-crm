/**
 * Meta Ads OAuth (Facebook Login, escopo ads_read) — conecta o módulo de
 * Campanhas diretamente às contas de anúncio do usuário, sem precisar colar
 * ID de conta ou token manualmente.
 *
 * Reaproveita o mesmo App do Meta usado por WhatsApp/CAPI (META_APP_ID/
 * META_APP_SECRET) — só precisa que o produto "Facebook Login" esteja
 * habilitado nesse App e que o escopo `ads_read` seja aprovado (Advanced
 * Access) ou testado com um usuário admin/tester do App.
 *
 * O token obtido aqui é guardado em organizations.meta_ads_access_token,
 * separado do meta_access_token do CAPI (ver 0118_meta_ads_oauth.sql).
 */

import { createHmac } from 'crypto'

export const GRAPH_VERSION = 'v26.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

/** Só leitura de relatórios de campanha — nada de criar/editar anúncios. */
export const ADS_SCOPES = 'ads_read'

export function isMetaAdsOAuthConfigured(): boolean {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET)
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/meta-ads/callback`
}

function stateSecret(): string {
  return process.env.META_APP_SECRET || 'dev-secret'
}

// ── CSRF state (signed, stateless) ───────────────────────────────────────────

export function signState(payload: { orgSlug: string; ts: number; clientId?: string }): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(raw).digest('base64url')
  return `${raw}.${sig}`
}

export function verifyState(state: string): { orgSlug: string; ts: number; clientId?: string } | null {
  const [raw, sig] = state.split('.')
  if (!raw || !sig) return null
  const expected = createHmac('sha256', stateSecret()).update(raw).digest('base64url')
  if (expected !== sig) return null
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (Date.now() - payload.ts > 15 * 60_000) return null // 15-min expiry
    return payload
  } catch {
    return null
  }
}

// ── OAuth flow (Facebook Login) ──────────────────────────────────────────────

export function buildOAuthDialogUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: ADS_SCOPES,
    state,
  })
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}

/** Troca o code por um token de usuário de curta duração. */
export async function exchangeCodeForToken(code: string): Promise<{ token: string }> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri(),
    code,
  })
  const res = await fetch(`${GRAPH}/oauth/access_token?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao trocar code por token')
  return { token: json.access_token as string }
}

/** Troca por um token de longa duração (~60 dias). */
export async function getLongLivedToken(shortToken: string): Promise<{ token: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  })
  const res = await fetch(`${GRAPH}/oauth/access_token?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao obter token de longa duração')
  return { token: json.access_token as string, expiresIn: json.expires_in ?? 60 * 24 * 3600 }
}

export type MetaAdAccountOption = {
  id: string // "act_123456"
  name: string
  account_status: number
}

/** Lista as contas de anúncio às quais o token tem acesso. */
export async function listAdAccountsForToken(token: string): Promise<MetaAdAccountOption[]> {
  const params = new URLSearchParams({ fields: 'id,name,account_status', access_token: token, limit: '200' })
  const res = await fetch(`${GRAPH}/me/adaccounts?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao listar contas de anúncio')
  return (json.data || []) as MetaAdAccountOption[]
}

export type MetaUserProfile = { id: string; name: string }

export async function getMetaUserProfile(token: string): Promise<MetaUserProfile> {
  const params = new URLSearchParams({ fields: 'id,name', access_token: token })
  const res = await fetch(`${GRAPH}/me?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao obter perfil do usuário')
  return { id: json.id, name: json.name }
}
