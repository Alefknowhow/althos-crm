/**
 * Google Business Profile (ex-"Google Meu Negócio") — OAuth + API client.
 *
 * Requires a Google Cloud project with:
 *   - "Business Profile API" access approved (Google requires a request form —
 *     it is NOT auto-granted like most Google APIs, so this must be requested
 *     well ahead of testing this flow for real).
 *   - An OAuth 2.0 Client ID (type "Web application") with this redirect URI
 *     registered: https://<domain>/api/google-business/callback
 *   - OAuth consent screen configured with the `business.manage` scope.
 *
 * Env vars:
 *   GOOGLE_BUSINESS_CLIENT_ID
 *   GOOGLE_BUSINESS_CLIENT_SECRET
 */

import { createHmac } from 'crypto'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const ACCOUNT_MGMT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1'
const BUSINESS_INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1'

export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage'

export function isGoogleBusinessConfigured(): boolean {
  return !!(process.env.GOOGLE_BUSINESS_CLIENT_ID && process.env.GOOGLE_BUSINESS_CLIENT_SECRET)
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/google-business/callback`
}

function stateSecret(): string {
  return process.env.GOOGLE_BUSINESS_CLIENT_SECRET || 'dev-secret'
}

// ── CSRF state (signed, stateless) — same scheme as the Instagram flow ──────

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
    if (Date.now() - payload.ts > 15 * 60_000) return null // 15-min expiry
    return payload
  } catch {
    return null
  }
}

// ── OAuth flow ────────────────────────────────────────────────────────────

export function buildOAuthDialogUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GBP_SCOPE,
    access_type: 'offline',   // required to receive a refresh_token
    prompt: 'consent',        // force refresh_token even on repeat connections
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/** Exchange the OAuth code for an access_token + refresh_token. */
export async function exchangeCodeForTokens(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(),
    code,
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description || json.error || 'Falha ao trocar code por token')
  if (!json.refresh_token) {
    throw new Error('Google não retornou refresh_token — revogue o acesso em myaccount.google.com/permissions e tente conectar de novo.')
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in ?? 3600 }
}

/** Exchange a stored refresh_token for a fresh access_token. */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description || json.error || 'Falha ao renovar token')
  return { accessToken: json.access_token, expiresIn: json.expires_in ?? 3600 }
}

// ── Business Profile data ────────────────────────────────────────────────

export type GbpAccount = { name: string; accountName: string | null }

/** List the Google Business accounts the authorized user has access to. */
export async function listGoogleBusinessAccounts(accessToken: string): Promise<GbpAccount[]> {
  const res = await fetch(`${ACCOUNT_MGMT_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao listar contas do Google Business')
  return (json.accounts || []).map((a: any) => ({ name: a.name, accountName: a.accountName ?? null }))
}

export type GbpLocation = { name: string; title: string | null; address: string | null }

/** List the locations (units/fichas) under a Google Business account. */
export async function listGoogleBusinessLocations(accessToken: string, accountName: string): Promise<GbpLocation[]> {
  const params = new URLSearchParams({ readMask: 'name,title,storefrontAddress' })
  const res = await fetch(`${BUSINESS_INFO_API}/${accountName}/locations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao listar unidades do Google Business')
  return (json.locations || []).map((l: any) => ({
    name: l.name,
    title: l.title ?? null,
    address: l.storefrontAddress
      ? [l.storefrontAddress.addressLines?.join(', '), l.storefrontAddress.locality].filter(Boolean).join(' — ')
      : null,
  }))
}
