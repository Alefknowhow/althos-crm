/**
 * Anti-spam defenses for public-facing endpoints.
 *
 * Three independent layers — each catches a different class of attack and
 * any one of them firing is enough to reject the request:
 *
 *   1. HONEYPOT — invisible field. Bots fill all fields; humans don't see it.
 *   2. MIN FILL TIME — bots submit forms in <1s; humans take ≥3s usually.
 *   3. RATE LIMIT — per-IP/endpoint throttle, backed by Postgres.
 *
 * Cloudflare Turnstile (optional, env-gated) is wired as a separate function
 * that the public actions call when CLOUDFLARE_TURNSTILE_SECRET is set.
 *
 * Each defense returns `{ ok: true }` on pass or `{ ok: false, reason }` on
 * block. Callers should return a generic "Erro ao enviar" message to the
 * user (don't leak that we caught them — keeps the next bot author guessing).
 */

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export type AntispamResult = { ok: true } | { ok: false; reason: string }

// Re-export client-safe constants so server code can still import from here.
export { HONEYPOT_FIELD_NAME, MIN_FILL_TIME_MS } from './antispam-constants'
import { MIN_FILL_TIME_MS } from './antispam-constants'

/**
 * Validates honeypot + min fill time. Both are passed by the client form:
 *   - `honeypot` is the literal value of the hidden input (should be empty)
 *   - `formMountedAt` is a timestamp set when the form first rendered
 */
export function checkHoneypotAndTiming(
  honeypotValue: string | null | undefined,
  formMountedAt: number | string | null | undefined,
): AntispamResult {
  if (honeypotValue && String(honeypotValue).trim() !== '') {
    return { ok: false, reason: 'honeypot' }
  }

  if (formMountedAt) {
    const mountedMs = typeof formMountedAt === 'string' ? parseInt(formMountedAt, 10) : formMountedAt
    if (Number.isFinite(mountedMs) && mountedMs > 0) {
      const elapsed = Date.now() - mountedMs
      // Reject only if VERY fast. Don't be too aggressive — flaky network
      // or browser quirks can make legit submissions look fast.
      if (elapsed < MIN_FILL_TIME_MS) {
        return { ok: false, reason: 'too_fast' }
      }
      // Also reject if the timestamp is in the future or absurdly old
      // (>7 days) — likely tampered.
      if (elapsed < 0 || elapsed > 7 * 24 * 60 * 60 * 1000) {
        return { ok: false, reason: 'tampered_timestamp' }
      }
    }
  }

  return { ok: true }
}

/* -------- Cloudflare Turnstile (optional) -------- */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Turnstile token server-side. Returns ok:true when:
 *   - The secret env var is NOT configured (Turnstile is optional)
 *   - OR the token is valid per Cloudflare
 *
 * Returns ok:false only when Turnstile IS configured and verification failed.
 */
export async function verifyTurnstileToken(token: string | null | undefined): Promise<AntispamResult> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET
  if (!secret) {
    // Turnstile not configured for this deployment — skip the check.
    return { ok: true }
  }

  if (!token) {
    return { ok: false, reason: 'turnstile_missing' }
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      return { ok: false, reason: 'turnstile_failed' }
    }
    return { ok: true }
  } catch (e) {
    // Network blip — fail OPEN (let request through) rather than block
    // legit users due to our infra problem. Spam will still hit other
    // layers (honeypot, timing, rate limit).
    console.warn('Turnstile verify network error:', e)
    return { ok: true }
  }
}

/* -------- Rate limit by IP + endpoint (Postgres-backed) -------- */

/**
 * Extracts caller IP from headers. On Vercel, `x-forwarded-for` is set;
 * locally it's empty. Returns '0.0.0.0' as a stable fallback so the rate
 * limiter never breaks on missing headers.
 */
export function getCallerIp(): string {
  try {
    const h = headers()
    // x-forwarded-for may be a comma-separated chain; first is the real client.
    const fwd = h.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0].trim()
    const real = h.get('x-real-ip')
    if (real) return real.trim()
    return '0.0.0.0'
  } catch {
    return '0.0.0.0'
  }
}

/**
 * Records the request AND returns ok:false if the IP+endpoint exceeded the
 * threshold in the recent window.
 *
 * Defaults: 10 requests per 60 minutes. Tune per endpoint via `options`.
 *
 * Uses admin client because the caller is anonymous (public form/booking).
 * The `public_request_log` table is org-less — we don't know the org yet
 * when rate-limiting the FIRST request.
 */
export async function checkAndRecordRateLimit(
  endpoint: string,
  options: { maxPerWindow?: number; windowMinutes?: number } = {},
): Promise<AntispamResult> {
  const maxPerWindow = options.maxPerWindow ?? 10
  const windowMinutes = options.windowMinutes ?? 60

  const ip = getCallerIp()
  const admin = createAdminClient()
  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString()

  // Count recent attempts FIRST so the new insert doesn't count against itself.
  const { count, error: countErr } = await admin
    .from('public_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('endpoint', endpoint)
    .gte('at', windowStart)

  if (countErr) {
    // If the rate limit table isn't there yet, fail OPEN — don't break the
    // form just because the migration wasn't applied. Logged for ops.
    console.warn('Rate limit check failed (table missing?):', countErr.message)
    return { ok: true }
  }

  // Always record this attempt (even if blocked) so repeated attempts during
  // the cooldown don't reset the clock.
  await admin.from('public_request_log').insert({
    ip,
    endpoint,
    at: new Date().toISOString(),
  })

  if ((count || 0) >= maxPerWindow) {
    return { ok: false, reason: 'rate_limited' }
  }

  return { ok: true }
}

/**
 * Compose all defenses in one call. Endpoint identifier is used by the
 * rate limiter. Returns ok:true only when ALL configured defenses pass.
 *
 * Callers should map ok:false to a generic user-facing error message and
 * log the reason internally — never leak the specific layer that blocked.
 */
export async function runAntispamGauntlet(
  endpoint: string,
  inputs: {
    honeypotValue?: string | null
    formMountedAt?: number | string | null
    turnstileToken?: string | null
  },
  rateLimitOptions?: { maxPerWindow?: number; windowMinutes?: number },
): Promise<AntispamResult> {
  // Cheap checks first — fail fast without any network or DB.
  const fast = checkHoneypotAndTiming(inputs.honeypotValue, inputs.formMountedAt)
  if (!fast.ok) return fast

  // Turnstile (1 network hop) before DB rate limit so we don't bloat the
  // log table with verified-bad bots.
  const ts = await verifyTurnstileToken(inputs.turnstileToken)
  if (!ts.ok) return ts

  const rl = await checkAndRecordRateLimit(endpoint, rateLimitOptions)
  if (!rl.ok) return rl

  return { ok: true }
}
