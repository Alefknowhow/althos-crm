/**
 * Shared webhook signature verification utilities.
 *
 * Two providers wired here:
 *
 *   • Resend  — uses the Svix signing scheme: three headers (svix-id,
 *               svix-timestamp, svix-signature) + a secret from the Resend
 *               dashboard (RESEND_WEBHOOK_SECRET). Without the secret the
 *               check fails CLOSED — unlike Turnstile which fails open,
 *               webhooks that mutate data must be strictly gated.
 *
 *   • Asaas   — uses a shared static token in the asaas-access-token header.
 *               We keep the same mechanism but compare with timingSafeEqual
 *               to eliminate timing-attack exposure.
 *
 * References:
 *   Svix signature spec: https://docs.svix.com/receiving/verifying-payloads/how
 *   Resend webhooks:     https://resend.com/docs/dashboard/webhooks/introduction
 */

import { createHmac, timingSafeEqual } from 'crypto'

// ---------------------------------------------------------------------------
// Resend / Svix-scheme verification
// ---------------------------------------------------------------------------

/**
 * Maximum age (seconds) we accept for a Svix timestamp. Replay attacks using
 * a captured payload are blocked after this window.
 */
const SVIX_TOLERANCE_SECONDS = 300 // 5 minutes

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Verifies a Resend webhook request using the Svix signing scheme.
 *
 * Algorithm (per Svix spec):
 *   1. Extract svix-id, svix-timestamp, svix-signature headers.
 *   2. Reject if timestamp is outside SVIX_TOLERANCE_SECONDS window.
 *   3. Compute HMAC-SHA256 of "<svix-id>.<svix-timestamp>.<raw-body>"
 *      using the webhook signing secret (base64-decoded, strip "whsec_" prefix).
 *   4. Compare against each comma-separated signature candidate in
 *      svix-signature using timingSafeEqual.
 *
 * @param rawBody  The request body as a string (call req.text() before .json()).
 * @param headers  A Headers-like object (or plain Record) with the svix-* keys.
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: Headers | Record<string, string | null>,
): WebhookVerifyResult {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Fail CLOSED: if the secret isn't configured, we refuse all payloads
    // rather than accepting unauthenticated mutations to lead_activities.
    console.warn('[webhook] RESEND_WEBHOOK_SECRET not set — rejecting all Resend webhooks')
    return { ok: false, reason: 'secret_not_configured' }
  }

  const get = (h: typeof headers, key: string): string | null =>
    typeof h === 'object' && h instanceof Headers ? h.get(key) : (h as any)[key] ?? null

  const svixId        = get(headers, 'svix-id')
  const svixTimestamp = get(headers, 'svix-timestamp')
  const svixSignature = get(headers, 'svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: 'missing_svix_headers' }
  }

  // Replay protection: reject if timestamp is too old or in the future.
  const ts = parseInt(svixTimestamp, 10)
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'invalid_timestamp' }
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  const delta = Math.abs(nowSeconds - ts)
  if (delta > SVIX_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp_too_old' }
  }

  // Decode the signing secret. Format is either bare base64 or "whsec_<base64>".
  const rawSecret = secret.startsWith('whsec_')
    ? secret.slice('whsec_'.length)
    : secret
  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(rawSecret, 'base64')
  } catch {
    return { ok: false, reason: 'invalid_secret_encoding' }
  }

  // Signature payload: "<id>.<timestamp>.<body>"
  const sigPayload = `${svixId}.${svixTimestamp}.${rawBody}`
  const computed = createHmac('sha256', secretBytes).update(sigPayload).digest('base64')
  const computedBuf = Buffer.from(`v1,${computed}`)

  // svix-signature may contain multiple space-separated "v1,<sig>" candidates
  // (key rotation). Accept if ANY candidate matches.
  const candidates = svixSignature.split(' ')
  for (const candidate of candidates) {
    const candidateBuf = Buffer.from(candidate.trim())
    if (computedBuf.length === candidateBuf.length) {
      try {
        if (timingSafeEqual(computedBuf, candidateBuf)) {
          return { ok: true }
        }
      } catch {
        // lengths differed after Buffer.from — skip.
      }
    }
  }

  return { ok: false, reason: 'signature_mismatch' }
}

// ---------------------------------------------------------------------------
// Generic static-token verification (Asaas pattern)
// ---------------------------------------------------------------------------

/**
 * Timing-safe comparison for shared-secret webhook tokens.
 * Use this for providers that send a static bearer token in a header rather
 * than computing a per-request HMAC (e.g. Asaas asaas-access-token).
 *
 * Falls back to rejecting if the env var is not set — same fail-CLOSED
 * policy as verifyResendWebhook.
 */
export function verifyStaticToken(
  incoming: string | null | undefined,
  envVarName: string,
): WebhookVerifyResult {
  const expected = process.env[envVarName]
  if (!expected) {
    console.warn(`[webhook] ${envVarName} not set — rejecting request`)
    return { ok: false, reason: 'secret_not_configured' }
  }
  if (!incoming) {
    return { ok: false, reason: 'token_missing' }
  }

  // Pad to the same length before timingSafeEqual to avoid length-based
  // timing leak. We always compare full expected length.
  const a = Buffer.from(expected)
  const b = Buffer.from(incoming.padEnd(expected.length, '\0').slice(0, expected.length))
  try {
    const match = timingSafeEqual(a, b) && incoming === expected
    return match ? { ok: true } : { ok: false, reason: 'token_mismatch' }
  } catch {
    return { ok: false, reason: 'token_mismatch' }
  }
}
