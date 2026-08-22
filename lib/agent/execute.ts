import type { AgentContext } from '@/lib/agent/context'
import { agentCanAccess } from '@/lib/agent/context'
import { logAgentToolCall } from '@/lib/agent/audit'
import type { PermissionKey } from '@/lib/permissions'

export type RiskLevel = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type ToolDef<Input> = {
  name: string
  description: string
  riskLevel: RiskLevel
  /** Ações MEDIUM+ ainda não têm approval flow nesta entrega — o
   *  Execution Engine recusa antes de chamar o handler. */
  requiresApproval: boolean
  permissionKey: PermissionKey
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
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const startedAt = Date.now()

  if (!agentCanAccess(ctx, tool.permissionKey)) {
    await logAgentToolCall({
      ctx, tool: tool.name, input, status: 'denied',
      error: `Sem permissão pro módulo "${tool.permissionKey}"`,
      executionMs: Date.now() - startedAt,
    })
    return { ok: false, error: `Sem permissão pro módulo "${tool.permissionKey}"` }
  }

  if (tool.requiresApproval) {
    await logAgentToolCall({
      ctx, tool: tool.name, input, status: 'denied',
      error: 'Ação requer aprovação — ainda não suportado nesta fase',
      executionMs: Date.now() - startedAt,
    })
    return { ok: false, error: 'Esta ação requer aprovação humana e ainda não é suportada via agente.' }
  }

  try {
    const data = await tool.handler(ctx, input)
    await logAgentToolCall({ ctx, tool: tool.name, input, status: 'success', executionMs: Date.now() - startedAt })
    return { ok: true, data }
  } catch (e: any) {
    const error = e?.message || 'Erro desconhecido'
    await logAgentToolCall({ ctx, tool: tool.name, input, status: 'error', error, executionMs: Date.now() - startedAt })
    return { ok: false, error }
  }
}
