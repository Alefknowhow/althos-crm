import type { AgentContext } from '@/lib/agent/context'
import { agentCanAccess } from '@/lib/agent/context'
import { logAgentToolCall } from '@/lib/agent/audit'
import type { PermissionKey } from '@/lib/permissions'
import { IRREVERSIBLE_WARNING, type ApprovalHandler } from './approval'
import { createApprovalRequest } from './approval-store'
import { isDeepStrictEqual } from 'node:util'

export type RiskLevel = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type ToolDef<Input> = {
  name: string
  description: string
  riskLevel: RiskLevel
  /** Fail closed unless the transport collects explicit human consent. */
  requiresApproval: boolean
  permissionKey: PermissionKey | null
  prepare?: (ctx: AgentContext, input: Input) => Promise<unknown>
  handler: (ctx: AgentContext, input: Input) => Promise<unknown>
}

/**
 * Etapa 3 (Agent Layer) — Execution Engine. Todo tool call passa por aqui:
 * checa permissão (reaproveita canAccess, mesma regra de qualquer Server
 * Action) → bloqueia ações que exigem aprovação (ainda não suportado) →
 * executa → audita (sucesso ou erro), sempre.
 */
export async function executeTool<Input>(
  tool: ToolDef<Input>,
  ctx: AgentContext,
  input: Input,
  approve?: ApprovalHandler,
  refreshContext?: () => Promise<AgentContext | null>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const startedAt = Date.now()

  if (tool.permissionKey && !agentCanAccess(ctx, tool.permissionKey)) {
    await logAgentToolCall({
      ctx, tool: tool.name, input, status: 'denied',
      error: `Sem permissão pro módulo "${tool.permissionKey}"`,
      executionMs: Date.now() - startedAt,
    })
    return { ok: false, error: `Sem permissão pro módulo "${tool.permissionKey}"` }
  }

  try {
    if (tool.requiresApproval) {
      const preview = tool.prepare ? await tool.prepare(ctx, input) : input
      if (!approve) return { ok: true, data: await createApprovalRequest(ctx, tool.name, input, preview) }
      if (!refreshContext) throw new Error('Não foi possível revalidar a autorização.')
      const accepted = await approve({ tool: tool.name, input, preview, warning: IRREVERSIBLE_WARNING })
      if (!accepted) throw new Error('Operação não autorizada pelo usuário. Nenhum dado foi alterado.')
      const fresh = await refreshContext()
      if (!fresh || fresh.orgId !== ctx.orgId || fresh.userId !== ctx.userId || (tool.permissionKey && !agentCanAccess(fresh, tool.permissionKey))) {
        throw new Error('Token ou permissão revogado após a confirmação. Nenhum dado foi alterado.')
      }
      ctx = fresh
      if (tool.prepare && !isDeepStrictEqual(await tool.prepare(ctx, input), preview)) {
        throw new Error('Os dados mudaram durante a confirmação. Solicite novamente para revisar os valores atuais.')
      }
    }
    const data = await tool.handler(ctx, input)
    await logAgentToolCall({ ctx, tool: tool.name, input, status: 'success', executionMs: Date.now() - startedAt })
    return { ok: true, data }
  } catch (e: any) {
    const error = e?.message || 'Erro desconhecido'
    await logAgentToolCall({ ctx, tool: tool.name, input, status: 'error', error, executionMs: Date.now() - startedAt })
    return { ok: false, error }
  }
}
