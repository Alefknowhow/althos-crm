import type { MemberRole, Permissions } from '@/lib/permissions'

/** Linha de agent_definitions (migration 0267). */
export type AgentDefinition = {
  id: string
  organization_id: string
  key: string
  name: string
  role_label: string | null
  description: string | null
  personality: string | null
  persona: string | null
  tone: string
  language: string
  objective: string | null
  success_criteria: string | null
  rules: string | null
  additional_instructions: string | null
  handoff_conditions: string | null
  autonomy_limits: Record<string, unknown>
  knowledge: string | null
  allowed_tools: string[]
  allowed_skills: string[]
  model: string
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Agent Runtime Invocation (issue #46): quem/o-quê está disparando esta
 * execução. Estende AgentContext (mesmo shape usado pelo Agent Layer MCP,
 * lib/agent/context.ts) com os campos de runtime que a issue #19 pede —
 * canal, contact, objetivo desta execução, evento de workflow, limites.
 *
 * Nunca resolvido a partir do Agent Definition — sempre a partir de quem/o
 * quê chamou de verdade (usuário logado, workflow, automação), do mesmo
 * jeito que resolveAgentContext() nunca confia num orgId vindo do client.
 */
export type AgentRuntimeContext = {
  orgId: string
  orgSlug: string
  accountId: string | null
  niche: string | null
  userId: string
  role: MemberRole
  permissions: Permissions
  /** Canal/origem da execução — ex.: "whatsapp", "settings_sandbox", "orchestrator". */
  channel?: string
  /** Conversa/thread, se aplicável. */
  conversationId?: string
  /** Contato/lead em foco, se aplicável — resolve "ele/isso" sem o caller repetir dados. */
  contactId?: string | null
  /** Objetivo desta execução específica (o mesmo Agent Definition pode ser invocado com objetivos diferentes). */
  objective?: string
  /** Evento/dados do workflow que disparou esta execução, se houver. */
  workflowEvent?: { type: string; data?: Record<string, unknown> }
  /** Teto de iterações de tool-use — default aplicado por invokeAgentDefinition se omitido. */
  maxIterations?: number
}

/**
 * Resultado estruturado de uma execução (issue #19 § "Resultado
 * estruturado") — contrato extensível de propósito: `type` não é uma union
 * fixa no código global (ex.: lead_qualified, human_handoff_requested,
 * objective_completed, unable_to_resolve são sugestões de convenção, não um
 * enum imposto), pra não travar cada novo caso de uso numa mudança de tipo
 * central.
 */
export type AgentResultEvent = {
  type: string
  data?: Record<string, unknown>
}

export type AgentInvocationTurn = { role: 'user' | 'assistant'; content: string }

export type AgentInvocationResult = {
  reply: string
  structuredResults: AgentResultEvent[]
  toolCalls: Array<{ name: string; input: Record<string, unknown>; output: string }>
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
  costUsdCents: number
  modelUsed: string
}
