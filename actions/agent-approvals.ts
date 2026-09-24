'use server'

/**
 * Revisão de ações de agente pendentes de aprovação (issue #51). Mesma
 * permissão de actions/agent-definitions.ts ('settings') — aprovar uma ação
 * de IA é uma decisão de configuração/governança, não uma tarefa comum.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { resolvePendingApproval, type PendingApproval } from '@/lib/agent/approvals'

async function requireApprovalsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

export async function listPendingApprovals(orgSlug: string): Promise<{ ok: true; items: PendingApproval[] } | { ok: false; error: string }> {
  const access = await requireApprovalsAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { data, error } = await supabase
    .from('agent_pending_approvals')
    .select('*')
    .eq('organization_id', access.org.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { ok: false, error: error.message }
  return { ok: true, items: (data ?? []) as PendingApproval[] }
}

async function review(orgSlug: string, approvalId: string, decision: 'approved' | 'rejected', note?: string) {
  const access = await requireApprovalsAccess(orgSlug)
  if (!access.ok) return access

  const res = await resolvePendingApproval(approvalId, access.org.id, decision, access.user.id, note)
  revalidatePath(`/app/${orgSlug}/configuracoes/aprovacoes`)
  return res
}

export async function approveAgentAction(orgSlug: string, approvalId: string, note?: string) {
  return review(orgSlug, approvalId, 'approved', note)
}

export async function rejectAgentAction(orgSlug: string, approvalId: string, note?: string) {
  return review(orgSlug, approvalId, 'rejected', note)
}
