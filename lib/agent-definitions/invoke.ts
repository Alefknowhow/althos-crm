import { respondAsAttendant } from '@/lib/ai/attendant-engine'
import { formatBusinessContext } from '@/lib/ai/business-context'
import { getActiveLibraryItems, libraryItemsToKnowledgeBase } from '@/lib/ai/library'
import { logAiExecution } from '@/lib/agent/audit'
import { createAdminClient } from '@/lib/supabase/server'
import { buildPersonaPromptFromDefinition } from './prompt'
import { resolveAnthropicTools, buildToolExecutor } from './tools'
import type { AgentDefinition, AgentInvocationResult, AgentInvocationTurn, AgentRuntimeContext, AgentResultEvent } from './types'
import type { AgentContext } from '@/lib/agent/context'

export type InvokeAgentDefinitionOptions = {
  definition: AgentDefinition
  runtimeContext: AgentRuntimeContext
  /** Texto cru de organizations.ai_business_context (issue #45) — resolvido pelo caller, não aqui. */
  businessContext?: string | null
  messages: AgentInvocationTurn[]
  apiKey: string
  baseURL?: string
  maxOutputTokens?: number
}

/**
 * Agent Runtime Invocation (issue #46): a mesma AgentDefinition pode ser
 * invocada com Runtime Contexts diferentes (canal, objetivo, contato...)
 * sem duplicar personalidade/regras/conhecimento. Esta função NÃO consome
 * créditos de IA nem checa feature/plano — isso é responsabilidade do
 * caller (mesmo padrão de lib/ai/attendant-engine.ts: motor recebe I/O já
 * resolvido; quem dispara decide o CreditModule/feature certo pro seu
 * cenário). O que esta função garante é a parte de segurança que não pode
 * variar por caller: toda tool call passa por executeTool() com o Runtime
 * Context real (nunca com base no que a definição "pede").
 */
export async function invokeAgentDefinition(opts: InvokeAgentDefinitionOptions): Promise<AgentInvocationResult> {
  const { definition, runtimeContext, businessContext, messages, apiKey, baseURL, maxOutputTokens } = opts

  if (!definition.is_active) {
    throw new Error(`Agent Definition "${definition.key}" está inativo.`)
  }

  // Nunca confia em orgId/permissions vindos da definição — só do Runtime
  // Context, resolvido pelo caller (ex.: resolveMemberRuntimeContext).
  const agentCtx: AgentContext = {
    orgId: runtimeContext.orgId,
    orgSlug: runtimeContext.orgSlug,
    accountId: runtimeContext.accountId,
    niche: runtimeContext.niche,
    userId: runtimeContext.userId,
    role: runtimeContext.role,
    permissions: runtimeContext.permissions,
    agentLabel: `agent_definition:${definition.key}`,
  }

  const structuredResults: AgentResultEvent[] = []
  const tools = resolveAnthropicTools(definition.allowed_tools)
  const executeToolFn = buildToolExecutor(agentCtx, structuredResults)

  // Biblioteca (issue #50) — conhecimento compartilhado da org, igual
  // Business Context (#45): resolvido aqui pra todo Agent Definition
  // automaticamente, sem cada um duplicar/selecionar itens manualmente.
  const libraryItems = await getActiveLibraryItems(createAdminClient(), agentCtx.orgId)

  const startedAt = Date.now()
  let result
  try {
    result = await respondAsAttendant(
      {
        personaPrompt: buildPersonaPromptFromDefinition(definition, { runtimeObjective: runtimeContext.objective }),
        businessContext: formatBusinessContext(businessContext),
        knowledgeBase: libraryItemsToKnowledgeBase(libraryItems),
        handoffPhrases: [],
        leadProfile: null,
        messages,
        tools,
        executeTool: executeToolFn,
      },
      {
        apiKey,
        baseURL,
        model: definition.model,
        maxOutputTokens,
        maxIterations: runtimeContext.maxIterations ?? 6,
      },
    )
  } catch (e: any) {
    await logAiExecution({
      organizationId: agentCtx.orgId,
      userId: agentCtx.userId,
      agentLabel: agentCtx.agentLabel,
      tool: 'chat_reply',
      status: 'error',
      error: e?.message || 'Erro ao invocar Agent Definition.',
      executionMs: Date.now() - startedAt,
    })
    throw e
  }

  // Tool calls individuais já são auditados dentro de buildToolExecutor
  // (via executeTool -> logAgentToolCall); esta linha resume a execução
  // inteira, cobrindo também turnos sem nenhuma tool call.
  await logAiExecution({
    organizationId: agentCtx.orgId,
    userId: agentCtx.userId,
    agentLabel: agentCtx.agentLabel,
    tool: 'chat_reply',
    status: 'success',
    executionMs: Date.now() - startedAt,
  })

  return {
    reply: result.reply,
    structuredResults,
    toolCalls: result.toolCalls.map(t => ({ name: t.name, input: t.input, output: t.output })),
    usage: result.usage,
    costUsdCents: result.costUsdCents,
    modelUsed: result.modelUsed,
  }
}
