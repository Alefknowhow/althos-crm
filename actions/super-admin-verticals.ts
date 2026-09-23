'use server'

/**
 * Concessão/revogação manual de vertical por conta (issue #33, usando o
 * registro de entitlement da #32 — lib/verticals/account-verticals.server.ts).
 * "Concessão manual não cria compra fictícia" — por isso `reason` é
 * obrigatório e sempre gravado tanto em account_verticals.granted_reason
 * quanto em super_admin_audit_log.
 */

import { revalidatePath } from 'next/cache'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { logAdminAction } from '@/lib/super-admin/audit'
import {
  getAccountVerticals,
  grantAccountVertical,
  requestAccountVerticalCancellation,
} from '@/lib/verticals/account-verticals.server'
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

  const before = await getAccountVerticals(accountId)
  const previous = before.find(v => v.vertical === vertical) ?? null

  const granted = await grantAccountVertical({
    accountId,
    vertical,
    grantedBy: me.id,
    reason: reason.trim(),
  })

  try {
    await logAdminAction({
      actorUserId: me.id,
      action: 'grant_account_vertical',
      targetAccountId: accountId,
      oldValue: previous ? { vertical: previous.vertical, status: previous.status } : null,
      newValue: { vertical: granted.vertical, status: granted.status },
      reason: reason.trim(),
    })
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Vertical concedida, mas o log de auditoria falhou.' }
  }

  revalidatePath('/super-admin/users')
  return { ok: true as const, vertical: granted }
}

export async function revokeVerticalFromAccount(accountId: string, vertical: NicheKey, reason: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  if (!reason || !reason.trim()) return { ok: false as const, error: 'Informe o motivo da revogação.' }

  const me = await getUser()
  if (!me) return { ok: false as const, error: 'Não autenticado' }

  const before = await getAccountVerticals(accountId)
  const previous = before.find(v => v.vertical === vertical) ?? null

  // Não apaga dados operacionais (issue #32) — só marca pending_cancellation.
  await requestAccountVerticalCancellation(accountId, vertical)

  try {
    await logAdminAction({
      actorUserId: me.id,
      action: 'revoke_account_vertical',
      targetAccountId: accountId,
      oldValue: previous ? { vertical: previous.vertical, status: previous.status } : null,
      newValue: { vertical, status: 'pending_cancellation' },
      reason: reason.trim(),
    })
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Revogação registrada, mas o log de auditoria falhou.' }
  }

  revalidatePath('/super-admin/users')
  return { ok: true as const }
}
