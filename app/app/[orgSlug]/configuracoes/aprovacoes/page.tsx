import { listPendingApprovals } from '@/actions/agent-approvals'
import AgentApprovalsView from '@/components/features/agent/AgentApprovalsView'

export const dynamic = 'force-dynamic'

/**
 * Issue #51 — revisão de ações de agente que exigem aprovação humana antes
 * de executar (tool.requiresApproval=true em lib/agent/execute.ts).
 */
export default async function AprovacoesPage({ params }: { params: { orgSlug: string } }) {
  const res = await listPendingApprovals(params.orgSlug)
  return <AgentApprovalsView orgSlug={params.orgSlug} initial={res.ok ? res.items : []} initialError={res.ok ? null : res.error} />
}
