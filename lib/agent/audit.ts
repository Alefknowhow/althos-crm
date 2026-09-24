import { createAdminClient } from '@/lib/supabase/server'
import type { AgentContext } from '@/lib/agent/context'

/**
 * Issue #47 (parte da #19) — log unificado de execuções de IA, não só as
 * que passam pelo Agent Layer MCP. `agent_audit_log` já era genérico o
 * bastante pra isso (agent_label é texto livre, sem CHECK — só
 * agent_tokens.agent_label tem enum fechado); esta função é o ponto único
 * de escrita, tanto pro MCP (logAgentToolCall abaixo) quanto pros chats
 * internos (financeiro/forms/automações/copiloto/social/Agent Definitions —
 * cada call site chama logAiExecution() diretamente, ver
 * actions/financial-ai.ts, actions/forms-ai.ts, lib/social/engine.ts etc.).
 */
export async function logAiExecution(params: {
  organizationId: string
  userId: string | null
  /** Identifica a origem. MCP usa o agent_label do token
   *  (claude_code/codex/outro, ver agent_tokens) sem prefixo, preservando
   *  o formato já gravado hoje; novas origens usam convenção
   *  "internal:<módulo>" ou "agent_definition:<key>". Texto livre, sem
   *  enum fechado. */
  agentLabel: string
  tool: string
  input?: unknown
  /** 'pending_approval' (issue #51) — ação enfileirada pra revisão humana,
   *  nem executada nem negada. Ver lib/agent/approvals.ts. */
  status: 'success' | 'error' | 'denied' | 'pending_approval'
  error?: string
  executionMs?: number
}) {
  const supabase = createAdminClient()
  await supabase.from('agent_audit_log').insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    agent_label: params.agentLabel,
    tool: params.tool,
    input: params.input ?? null,
    status: params.status,
    error: params.error ?? null,
    execution_ms: params.executionMs ?? null,
  })
}

export async function logAgentToolCall(params: {
  ctx: AgentContext
  tool: string
  input: unknown
  status: 'success' | 'error' | 'denied' | 'pending_approval'
  error?: string
  executionMs: number
}) {
  await logAiExecution({
    organizationId: params.ctx.orgId,
    userId: params.ctx.userId,
    agentLabel: params.ctx.agentLabel,
    tool: params.tool,
    input: params.input,
    status: params.status,
    error: params.error,
    executionMs: params.executionMs,
  })
}
