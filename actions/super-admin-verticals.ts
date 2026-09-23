'use server'

/**
 * Concessão/revogação manual de vertical por conta (issue #33, usando o
 * registro de entitlement da #32 — lib/verticals/account-verticals.server.ts).
 * "Concessão manual não cria compra fictícia" — por isso `reason` é
 * obrigatório e sempre gravado tanto em account_verticals.granted_reason
 * quanto em super_admin_audit_log.
 *
 * A mutação de account_verticals e o insert de auditoria acontecem na
 * mesma transação (RPCs admin_grant_account_vertical/
 * admin_revoke_account_vertical, migration 0266) — um erro no log de
 * auditoria reverte a concessão/revogação inteira em vez de deixá-la
 * commitada sem registro (achado da revisão automática da PR #38).
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { getAccountVerticals } from '@/lib/verticals/account-verticals.server'
import type { NicheKey } from '@/lib/niche'

export async function getAccountVerticalsForAdmin(accountId: string) {
  if (!(await isSuperAdmin())) return []
  return getAccountVerticals(accountId)
}

export async function grantVerticalToAccount(accountId: string, vertical: NicheKey, reason: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  if (!reason || !reason.trim()) return { ok: false as const, error: 'Informe o motivo da concessão.' }

  const me = await getUser()
  if (!me) return { ok: false as const, error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.rpc('admin_grant_account_vertical', {
    p_account_id: accountId,
    p_vertical: vertical,
    p_granted_by: me.id,
    p_reason: reason.trim(),
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/super-admin/users')
  return { ok: true as const }
}

export async function revokeVerticalFromAccount(accountId: string, vertical: NicheKey, reason: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  if (!reason || !reason.trim()) return { ok: false as const, error: 'Informe o motivo da revogação.' }

  const me = await getUser()
  if (!me) return { ok: false as const, error: 'Não autenticado' }

  const admin = createAdminClient()
  // Não apaga dados operacionais (issue #32) — a RPC só marca pending_cancellation.
  const { error } = await admin.rpc('admin_revoke_account_vertical', {
    p_account_id: accountId,
    p_vertical: vertical,
    p_actor_id: me.id,
    p_reason: reason.trim(),
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/super-admin/users')
  return { ok: true as const }
}
