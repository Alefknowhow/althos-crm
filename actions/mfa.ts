'use server'

import { createHash, randomBytes } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/** Number of single-use recovery codes generated per batch. */
const RECOVERY_CODE_COUNT = 8

/** Normalize a recovery code for hashing/compare: lowercase, strip non-alphanumerics. */
function normalizeCode(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function hashCode(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex')
}

/** Generate a human-friendly code like "a1b2c-3d4e5" (10 chars, grouped). */
function makeCode(): string {
  const raw = randomBytes(5).toString('hex') // 10 hex chars
  return `${raw.slice(0, 5)}-${raw.slice(5)}`
}

/**
 * Current 2FA state for the signed-in user: whether a verified TOTP factor
 * exists and how many unused recovery codes remain.
 */
export async function getMfaStatus(): Promise<{
  enabled: boolean
  recoveryRemaining: number
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { enabled: false, recoveryRemaining: 0 }

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const enabled = (factors?.totp ?? []).some(f => f.status === 'verified')

  const { count } = await supabase
    .from('user_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('used_at', null)

  return { enabled, recoveryRemaining: count ?? 0 }
}

/**
 * (Re)generate the batch of recovery codes for the signed-in user. Any previous
 * codes are discarded. Returns the PLAINTEXT codes exactly once — they are only
 * ever stored hashed, so the caller MUST surface them to the user now.
 */
export async function generateRecoveryCodes(): Promise<
  { ok: true; codes: string[] } | { ok: false; error: string }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, makeCode)
  const rows = codes.map(c => ({
    user_id: user.id,
    code_hash: hashCode(normalizeCode(c)),
  }))

  const admin = createAdminClient()
  // Replace any existing batch so old printed codes stop working.
  const { error: delErr } = await admin
    .from('user_recovery_codes')
    .delete()
    .eq('user_id', user.id)
  if (delErr) return { ok: false, error: 'Falha ao limpar códigos antigos.' }

  const { error: insErr } = await admin.from('user_recovery_codes').insert(rows)
  if (insErr) return { ok: false, error: 'Falha ao gerar códigos.' }

  return { ok: true, codes }
}

/**
 * Redeem a recovery code (used when the user lost their authenticator device).
 * On success the code is consumed AND every MFA factor on the account is removed,
 * dropping the user back to password-only access so they can sign in and
 * re-enroll. Requires an active (aal1) session.
 */
export async function redeemRecoveryCode(
  rawCode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const normalized = normalizeCode(rawCode)
  if (!normalized) return { ok: false, error: 'Código inválido.' }
  const hash = hashCode(normalized)

  const admin = createAdminClient()
  const { data: match } = await admin
    .from('user_recovery_codes')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', hash)
    .is('used_at', null)
    .maybeSingle()

  if (!match) return { ok: false, error: 'Código de recuperação inválido ou já usado.' }

  // Consume the code.
  await admin
    .from('user_recovery_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', match.id)

  // Remove every MFA factor so the user regains access at password level.
  try {
    const { data: list } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
    for (const f of list?.factors ?? []) {
      await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
    }
  } catch {
    return { ok: false, error: 'Falha ao remover o fator de autenticação.' }
  }

  return { ok: true }
}

/** Discard all recovery codes (e.g. when the user disables 2FA entirely). */
export async function clearRecoveryCodes(): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const admin = createAdminClient()
  await admin.from('user_recovery_codes').delete().eq('user_id', user.id)
}
