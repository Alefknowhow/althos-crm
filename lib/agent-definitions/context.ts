import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import type { MemberRole, Permissions } from '@/lib/permissions'
import type { AgentRuntimeContext } from './types'

/**
 * Resolve o Runtime Context (issue #46) a partir do usuário atualmente
 * logado — equivalente a resolveAgentContext() (lib/agent/context.ts), que
 * resolve a partir de um Personal Access Token do Agent Layer MCP. Aqui a
 * fonte é a sessão real, não um token de agente externo: quem chama
 * invokeAgentDefinition() em nome de um humano usa esta função para nunca
 * confiar em orgId/role/permissions vindos do client.
 */
export async function resolveMemberRuntimeContext(
  orgSlug: string,
  extra?: Partial<Pick<AgentRuntimeContext, 'channel' | 'conversationId' | 'contactId' | 'objective' | 'workflowEvent' | 'maxIterations'>>,
): Promise<AgentRuntimeContext> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: membership } = await supabase
    .from('memberships')
    .select('role, permissions')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    throw new Error('Usuário não é membro desta organização.')
  }

  return {
    orgId: org.id,
    orgSlug: (org as { slug: string }).slug,
    accountId: (org as { account_id?: string | null }).account_id ?? null,
    niche: (org as { niche?: string | null }).niche ?? null,
    userId: user.id,
    role: membership.role as MemberRole,
    permissions: (membership.permissions ?? {}) as Permissions,
    ...extra,
  }
}
