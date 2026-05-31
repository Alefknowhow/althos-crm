/**
 * Instagram API client — "Instagram API with Instagram Login" flow.
 *
 * This is Meta's current recommended path for DM/comment automation. The user
 * logs in DIRECTLY with their Instagram professional account (no Facebook Page
 * required), we receive an Instagram user access token, and we use the
 * graph.instagram.com endpoints to read/send messages and comments.
 *
 * Credentials are the *Instagram app* ID/secret (found in the Meta App under
 * Instagram → API setup with Instagram login), NOT the Facebook app id/secret.
 *
 * Required Meta App setup (see the settings page for the user-facing guide):
 *   - Product "Instagram" → "API setup with Instagram login"
 *   - Business login permissions: instagram_business_basic,
 *     instagram_business_manage_messages, instagram_business_manage_comments
 *   - OAuth redirect URI registered:
 *       https://<domain>/api/social/instagram/callback
 *   - The Instagram account must be Professional (Business/Creator).
 */

import { createHmac } from 'crypto'

export const GRAPH_VERSION = 'v21.0'
const IG_GRAPH = 'https://graph.instagram.com'
const IG_GRAPH_V = `https://graph.instagram.com/${GRAPH_VERSION}`

/** Scopes requested during the Instagram OAuth dialog. */
export const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
].join(',')

export function isInstagramConfigured(): boolean {
  return !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)
}

/** Absolute base URL of the app (used to build OAuth redirect URIs). */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://althos-crm.vercel.app'
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/social/instagram/callback`
}

/** Stable secret for signing the OAuth `state` (internal CSRF token). */
function stateSecret(): string {
  return process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || 'dev-secret'
}

// ── CSRF state (signed, stateless) ───────────────────────────────────────────

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

// ── OAuth flow (Instagram login) ─────────────────────────────────────────────

export function buildOAuthDialogUrl(state: string): string {
  const params = new URLSearchParams({
    enable_fb_login: '0',
    force_authentication: '1',
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: IG_SCOPES,
    state,
  })
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`
}

/** Exchange the OAuth code for a short-lived Instagram user token + user id. */
export async function exchangeCodeForToken(
  code: string,
): Promise<{ token: string; userId: string }> {
  // Instagram appends "#_" to the returned code — strip any fragment.
  const cleanCode = code.split('#')[0]
  const body = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(),
    code: cleanCode,
  })
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error_message || json.error?.message || 'Falha ao trocar code por token')
  }
  return { token: json.access_token as string, userId: String(json.user_id) }
}

/** Exchange a short-lived token for a long-lived (~60-day) one. */
export async function getLongLivedToken(
  shortToken: string,
): Promise<{ token: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    access_token: shortToken,
  })
  const res = await fetch(`${IG_GRAPH}/access_token?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao obter token de longa duração')
  return { token: json.access_token as string, expiresIn: json.expires_in ?? 60 * 24 * 3600 }
}

export type IgProfile = { id: string; username: string; name: string | null }

/** Fetch the connected Instagram professional account profile. */
export async function getInstagramProfile(token: string): Promise<IgProfile> {
  const params = new URLSearchParams({
    fields: 'user_id,username,name',
    access_token: token,
  })
  const res = await fetch(`${IG_GRAPH_V}/me?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao obter perfil do Instagram')
  // `user_id` is the value that matches the webhook payload's entry.id.
  return {
    id: String(json.user_id ?? json.id),
    username: json.username,
    name: json.name ?? null,
  }
}

/** Subscribe the connected Instagram account to the webhook fields. */
export async function subscribeInstagramWebhooks(token: string): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: 'messages,comments,mentions,message_reactions',
    access_token: token,
  })
  const res = await fetch(`${IG_GRAPH_V}/me/subscribed_apps?${params.toString()}`, { method: 'POST' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Non-fatal: log but don't abort the whole connection — the user can retry.
    console.warn('[instagram] subscribeInstagramWebhooks failed:', json.error?.message)
  }
}

// ── Sending replies ──────────────────────────────────────────────────────────

/** Send a direct message to a user (by their Instagram-scoped ID / IGSID). */
export async function sendInstagramDM(
  _igAccountId: string,
  token: string,
  recipientId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${IG_GRAPH_V}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Falha ao enviar DM no Instagram')
  }
}

/** Public reply under a comment. */
export async function replyToComment(commentId: string, token: string, text: string): Promise<void> {
  const res = await fetch(`${IG_GRAPH_V}/${commentId}/replies?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Falha ao responder comentário')
  }
}

/** Private reply (DM) triggered by a comment — uses the comment_id as recipient. */
export async function privateReplyToComment(
  _igAccountId: string,
  token: string,
  commentId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${IG_GRAPH_V}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.warn('[instagram] privateReplyToComment failed:', err.error?.message)
  }
}
