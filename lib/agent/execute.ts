import type { AgentContext } from '@/lib/agent/context'
import { agentCanAccess } from '@/lib/agent/context'
import { logAgentToolCall } from '@/lib/agent/audit'
import { enqueueApproval } from '@/lib/agent/approvals'
import { createNotification } from '@/actions/notifications'
import type { PermissionKey } from '@/lib/permissions'
import { hasCapability } from '@/lib/capabilities/resolve.server'
import type { CapabilityKey } from '@/lib/capabilities/types'

export type RiskLevel = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type ToolDef<Input> = {
  name: string
  description: string
  riskLevel: RiskLevel
  /** true = enfileira em agent_pending_approvals (issue #51) em vez de
   *  executar direto — precisa de aprovação humana antes de rodar. */
  requiresApproval: boolean
  permissionKey: PermissionKey
  /**
   * Opcional (issue #31) — quando presente, o Execution Engine também exige
   * a capability (plano + nicho/kill-switch, além da permissão acima) antes
   * de rodar o handler. Tools de módulos de vertical (viagens/clínicas/...)
   * ou que consomem um feature flag de plano devem declarar isto; tools
   * puramente Core sem gate de plano/nicho podem omitir.
   */
  capabilityKey?: CapabilityKey
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

  if (tool.capabilityKey) {
    const capability = await hasCapability(
      { accountId: ctx.accountId, niche: ctx.niche, role: ctx.role, permissions: ctx.permissions },
      tool.capabilityKey,
    )
    if (!capability.allowed) {
      await logAgentToolCall({
        ctx, tool: tool.name, input, status: 'denied',
        error: capability.reason, executionMs: Date.now() - startedAt,
      })
      return { ok: false, error: capability.reason }
    }
  }

  if (tool.requiresApproval) {
    const { id } = await enqueueApproval({ ctx, tool: tool.name, input })
    await logAgentToolCall({
      ctx, tool: tool.name, input, status: 'pending_approval',
      error: 'Ação enfileirada para aprovação humana.',
      executionMs: Date.now() - startedAt,
    })
    await createNotification({
      organizationId: ctx.orgId,
      userId: ctx.userId,
      type: 'agent_approval_pending',
      title: `Aprovação pendente: ${tool.name}`,
      content: `O agente "${ctx.agentLabel}" pediu pra executar "${tool.name}" e está aguardando sua aprovação.`,
      link: `/app/${ctx.orgSlug}/configuracoes/aprovacoes`,
    })
    return {
      ok: false,
      error: `Esta ação requer aprovação humana antes de ser executada. Foi enfileirada (id ${id}) — avise o usuário que precisa revisar e aprovar em Configurações → Aprovações antes que ela aconteça de verdade.`,
    }
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
