import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import { TOOL_REGISTRY } from '@/lib/agent/tools/registry'
import { executeTool } from '@/lib/agent/execute'
import type { AgentContext } from '@/lib/agent/context'
import type { AgentResultEvent } from './types'

const EMIT_RESULT_TOOL_NAME = 'emit_result'

/** zod raw shape -> Anthropic input_schema (Zod v4 tem toJSONSchema nativo). */
function shapeToInputSchema(shape: Record<string, unknown>): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(z.object(shape as z.ZodRawShape)) as Record<string, unknown>
  const { $schema: _drop, ...rest } = jsonSchema
  return rest
}

/**
 * Resolve as tools Anthropic (formato messages.create) que um Agent
 * Definition pode OFERECER ao modelo, a partir do seu allowed_tools —
 * SEMPRE só um subconjunto de lib/agent/tools/registry.ts. allowed_tools é
 * uma restrição adicional, nunca uma concessão: a autorização real
 * acontece em executeTool() a cada chamada (permissão + capability do
 * Runtime Context de quem disparou a execução).
 */
export function resolveAnthropicTools(allowedToolNames: string[]): Anthropic.Messages.Tool[] {
  const allowed = new Set(allowedToolNames)
  const registryTools: Anthropic.Messages.Tool[] = TOOL_REGISTRY
    .filter(({ tool }) => allowed.has(tool.name))
    .map(({ tool, inputShape }) => ({
      name: tool.name,
      description: tool.description,
      input_schema: shapeToInputSchema(inputShape) as Anthropic.Messages.Tool.InputSchema,
    }))

  const emitResultTool: Anthropic.Messages.Tool = {
    name: EMIT_RESULT_TOOL_NAME,
    description:
      'Registra um evento estruturado desta execução, além da resposta em texto — ex.: lead_qualified, human_handoff_requested, objective_completed, unable_to_resolve. Pode ser chamado mais de uma vez se mais de um evento for relevante. Não interrompe a conversa: continue respondendo normalmente depois.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Identificador do evento em snake_case (ex.: lead_qualified, human_handoff_requested). Não é uma lista fechada — use o que melhor descreve o resultado.' },
        data: { type: 'object', description: 'Dados adicionais do evento, se houver (opcional).' },
      },
      required: ['type'],
    },
  }

  return [...registryTools, emitResultTool]
}

/**
 * Executor a ser passado como AttendantInput.executeTool. Tools do registry
 * passam por executeTool() (permissão + capability + auditoria); emit_result
 * só acumula no array de resultados estruturados, nunca escreve no banco.
 */
export function buildToolExecutor(ctx: AgentContext, structuredResults: AgentResultEvent[]) {
  return async (name: string, input: Record<string, unknown>): Promise<string> => {
    if (name === EMIT_RESULT_TOOL_NAME) {
      const type = typeof input.type === 'string' ? input.type : 'unknown'
      const data = input.data && typeof input.data === 'object' ? (input.data as Record<string, unknown>) : undefined
      structuredResults.push({ type, data })
      return 'Evento registrado.'
    }

    const entry = TOOL_REGISTRY.find(({ tool }) => tool.name === name)
    if (!entry) return JSON.stringify({ ok: false, error: `Ferramenta "${name}" não reconhecida.` })

    const parsed = z.object(entry.inputShape as z.ZodRawShape).safeParse(input)
    if (!parsed.success) {
      return JSON.stringify({ ok: false, error: `Entrada inválida para "${name}": ${parsed.error.message}` })
    }

    const result = await executeTool(entry.tool, ctx, parsed.data)
    return JSON.stringify(result)
  }
}
