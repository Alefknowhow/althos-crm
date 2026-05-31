/**
 * Instagram Graph API client (Messenger / Instagram messaging + comments).
 *
 * Connecting an Instagram account for DM/comment automation is OAuth-based, not
 * a static "API key": the user authorises our Meta App via Facebook Login, and
 * we receive a per-page access token. There is no single key to paste.
 *
 * Required Meta App setup (see the settings page for the user-facing guide):
 *   - Product "Facebook Login" + "Instagram" added to the App
 *   - Permissions (App Review): instagram_basic, instagram_manage_messages,
 *     instagram_manage_comments, pages_show_list, pages_manage_metadata,
 *     pages_read_engagement, business_management
 *   - The Instagram account must be Professional (Business/Creator) and linked
 *     to a Facebook Page.
 */

import { createHmac } from 'crypto'

export const GRAPH_VERSION = 'v21.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

/** Scopes we request during the OAuth dialog. */
export const IG_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'instagram_manage_comments',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'business_management',
].join(',')

export function isInstagramConfigured(): boolean {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET)
}

/** Absolute base URL of the app (used to build OAuth redirect URIs). */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://althos-crm.vercel.app'
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/social/instagram/callback`
}

// ── CSRF state (signed, stateless) ───────────────────────────────────────────

/** Sign an OAuth `state` payload so the callback can trust the orgSlug without
 *  a server-side session store. HMAC keyed by the app secret. */
export function signState(payload: { orgSlug: string; ts: number }): string {
  const secret = process.env.META_APP_SECRET || 'dev-secret'
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(raw).digest('base64url')
  return `${raw}.${sig}`
}

export function verifyState(state: string): { orgSlug: string; ts: number } | null {
  const secret = process.env.META_APP_SECRET || 'dev-secret'
  const [raw, sig] = state.split('.')
  if (!raw || !sig) return null
  const expected = createHmac('sha256', secret).update(raw).digest('base64url')
  if (expected !== sig) return null
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    // Expire states older than 15 minutes.
    if (Date.now() - payload.ts > 15 * 60_000) return null
    return payload
  } catch {
    return null
  }
}

// ── OAuth flow ───────────────────────────────────────────────────────────────

export function buildOAuthDialogUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri(),
    state,
    scope: IG_SCOPES,
    response_type: 'code',
  })
  // NOTE: the user-facing OAuth dialog lives at www.facebook.com WITHOUT a
  // version segment. Including /vXX.X/ here makes Facebook reject the request
  // with PLATFORM__INVALID_APP_ID. (The version only applies to graph.facebook.com.)
  return `https://www.facebook.com/dialog/oauth?${params.toString()}`
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
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao trocar code por token')
  return json.access_token as string
}

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

export type IgPage = {
  pageId: string
  pageName: string
  pageAccessToken: string
  igAccountId: string | null
  igUsername: string | null
}

/** Returns the user's Pages along with any linked Instagram business account. */
export async function getUserPagesWithInstagram(userToken: string): Promise<IgPage[]> {
  const params = new URLSearchParams({
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    access_token: userToken,
  })
  const res = await fetch(`${GRAPH}/me/accounts?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Falha ao listar páginas')
  return (json.data || []).map((p: any) => ({
    pageId: p.id,
    pageName: p.name,
    pageAccessToken: p.access_token,
    igAccountId: p.instagram_business_account?.id ?? null,
    igUsername: p.instagram_business_account?.username ?? null,
  }))
}

/** Subscribe the Page to the messages + comments webhook fields. */
export async function subscribePageWebhooks(pageId: string, pageToken: string): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: 'messages,messaging_postbacks,comments,mentions',
    access_token: pageToken,
  })
  const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps?${params.toString()}`, { method: 'POST' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Non-fatal: log but don't abort the whole connection — the user can retry.
    console.warn('[instagram] subscribePageWebhooks failed:', json.error?.message)
  }
}

// ── Sending replies ──────────────────────────────────────────────────────────

/** Send a direct message to a user (by their Instagram-scoped ID / IGSID). */
export async function sendInstagramDM(
  igAccountId: string,
  pageToken: string,
  recipientId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${GRAPH}/${igAccountId}/messages?access_token=${encodeURIComponent(pageToken)}`, {
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
export async function replyToComment(commentId: string, pageToken: string, text: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${commentId}/replies?access_token=${encodeURIComponent(pageToken)}`, {
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
  igAccountId: string,
  pageToken: string,
  commentId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${GRAPH}/${igAccountId}/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.warn('[instagram] privateReplyToComment failed:', err.error?.message)
  }
}
