import { createAdminClient } from '@/lib/supabase/server'
import type { AgentContext } from '@/lib/agent/context'

export async function logAgentToolCall(params: {
  ctx: AgentContext
  tool: string
  input: unknown
  status: 'success' | 'error' | 'denied'
  error?: string
  executionMs: number
}) {
  const supabase = createAdminClient()
  await supabase.from('agent_audit_log').insert({
    organization_id: params.ctx.orgId,
    user_id: params.ctx.userId,
    agent_label: params.ctx.agentLabel,
    tool: params.tool,
    input: params.input ?? null,
    status: params.status,
    error: params.error ?? null,
    execution_ms: params.executionMs,
  })
}
