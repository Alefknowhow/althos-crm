// Server-only — uses next/headers via createClient.
// DO NOT import this file from Client Components.
// For pure types/helpers usable in both client and server, use lib/permissions.ts

import { createClient } from '@/lib/supabase/server'
import { canAccess, type MemberRole, type PermissionKey, type Permissions } from '@/lib/permissions'

/**
 * Verifica se o usuário autenticado tem permissão para acessar um módulo.
 * Deve ser chamado no início de Server Actions que modificam dados sensíveis.
 *
 * Exemplo de uso numa action:
 *   const check = await checkMemberPermission(org.id, user.id, 'catalog')
 *   if (!check.allowed) return { ok: false as const, error: check.reason }
 */
export async function checkMemberPermission(
  orgId: string,
  userId: string,
  key: PermissionKey,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const supabase = createClient()

  const { data: membership } = await supabase
    .from('memberships')
    .select('role, permissions')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return { allowed: false, reason: 'Acesso não autorizado.' }
  }

  const role        = membership.role as MemberRole
  const permissions = (membership.permissions ?? {}) as Permissions

  if (!canAccess(role, permissions, key)) {
    return { allowed: false, reason: `Você não tem permissão para acessar o módulo "${key}".` }
  }

  return { allowed: true }
}
