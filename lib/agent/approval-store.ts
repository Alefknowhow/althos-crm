import { createAdminClient } from '@/lib/supabase/server'
import type { AgentContext } from './context'
import { IRREVERSIBLE_WARNING } from './approval'

export async function createApprovalRequest(ctx: AgentContext, tool: string, input: unknown, preview: unknown) {
  const { data, error } = await createAdminClient().from('agent_approval_requests').insert({
    organization_id: ctx.orgId, user_id: ctx.userId, token_id: ctx.tokenId,
    tool, input, preview, expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  }).select('id, expires_at').single()
  if (error) throw new Error('Não foi possível registrar a autorização. Nenhum dado foi alterado.')
  return {
    status: 'awaiting_approval', operationId: data.id, expiresAt: data.expires_at,
    warning: IRREVERSIBLE_WARNING, preview,
    approvalUrl: `https://www.althoscrm.com.br/app/${encodeURIComponent(ctx.orgSlug)}/mcp-aprovacoes/${data.id}`,
    instructions: 'Comunique no chat a operação, os dados afetados e o aviso. Peça autorização ao usuário pelo link de revisão. Somente o usuário autenticado pode autorizar. Depois consulte get_operation_status. Não afirme que a alteração já foi feita.',
  }
}
