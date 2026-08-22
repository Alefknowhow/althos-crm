import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import type { MemberRole, PermissionKey, Permissions } from '@/lib/permissions'
import { canAccess } from '@/lib/permissions'

/**
 * Etapa 3 (Agent Layer) — Agent Context: quem está chamando o MCP e em nome
 * de qual org/usuário. Resolvido a partir de um Personal Access Token
 * (agent_tokens) — nunca confia em orgId/clientId vindo do agente sem essa
 * resolução (mesmo princípio de getCurrentOrganization já usado por toda
 * Server Action do projeto).
 */

export type AgentContext = {
  orgId: string
  orgSlug: string
  userId: string
  role: MemberRole
  permissions: Permissions
  agentLabel: string
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Resolve um Bearer token pro Agent Context, ou null se inválido/revogado. */
export async function resolveAgentContext(bearerToken: string): Promise<AgentContext | null> {
  const supabase = createAdminClient()
  const tokenHash = hashToken(bearerToken)

  const { data: tokenRow } = await supabase
    .from('agent_tokens')
    .select('id, organization_id, user_id, agent_label, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow || tokenRow.revoked_at) return null

  const [{ data: org }, { data: membership }] = await Promise.all([
    supabase.from('organizations').select('id, slug').eq('id', tokenRow.organization_id).maybeSingle(),
    supabase
      .from('memberships')
      .select('role, permissions')
      .eq('organization_id', tokenRow.organization_id)
      .eq('user_id', tokenRow.user_id)
      .maybeSingle(),
  ])

  if (!org || !membership) return null

  // Best-effort — não bloqueia a chamada se falhar.
  await supabase.from('agent_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id)

  return {
    orgId: org.id,
    orgSlug: org.slug,
    userId: tokenRow.user_id,
    role: membership.role as MemberRole,
    permissions: (membership.permissions ?? {}) as Permissions,
    agentLabel: tokenRow.agent_label,
  }
}

/** Mesma checagem que checkMemberPermission — sem round-trip ao banco, já
 *  que o Agent Context já carrega role/permissions resolvidos. */
export function agentCanAccess(ctx: AgentContext, key: PermissionKey): boolean {
  return canAccess(ctx.role, ctx.permissions, key)
}
