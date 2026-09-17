/**
 * Next Best Action (spec §16) — dado o contexto comercial atual, decide o
 * que o vendedor deveria fazer AGORA. Usa um modelo mais capaz que o
 * Context/Event Engine (raciocínio comercial, não só extração — spec §14),
 * chamado com cadência controlada pelo caller (não a cada evento).
 *
 * Não importa `resolveAnthropicEngine()` (mesmo motivo das outras engines
 * deste módulo — incompatível com Vitest) — o caller resolve e passa
 * `{apiKey, baseURL}` pronto.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SalesContext } from './types'

export type NextBestActionKind = 'PERGUNTE' | 'APROFUNDE' | 'QUANTIFIQUE' | 'INVESTIGUE' | 'RESPONDA' | 'AVANCE' | 'SEGURE'

export interface NextBestAction {
  action: NextBestActionKind
  message: string
  reasoning: string
}

const NBA_TOOL: Anthropic.Tool = {
  name: 'recommend_next_best_action',
  description:
    'Recomenda a próxima ação do vendedor com base no contexto comercial da reunião até agora.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['PERGUNTE', 'APROFUNDE', 'QUANTIFIQUE', 'INVESTIGUE', 'RESPONDA', 'AVANCE', 'SEGURE'],
      },
      message: { type: 'string', description: 'O que dizer/perguntar, pronto pra usar (1-2 frases).' },
      reasoning: { type: 'string', description: 'Por que essa é a ação certa agora (1 frase, evidência do contexto).' },
    },
    required: ['action', 'message', 'reasoning'],
  },
}

export interface GenerateNextBestActionInput {
  context: SalesContext
  /** `{apiKey, baseURL}` já resolvido pelo caller via `resolveAnthropicEngine()`, OU um client pronto (testes). */
  engine?: { apiKey: string; baseURL?: string }
  client?: Anthropic
  model?: string
}

export async function generateNextBestAction(input: GenerateNextBestActionInput): Promise<NextBestAction | null> {
  const client =
    input.client ?? new Anthropic({ apiKey: input.engine?.apiKey ?? '', ...(input.engine?.baseURL && { baseURL: input.engine.baseURL }) })

  const response = await client.messages.create({
    model: input.model || 'claude-sonnet-4-6',
    max_tokens: 512,
    tools: [NBA_TOOL],
    tool_choice: { type: 'tool', name: 'recommend_next_best_action' },
    messages: [
      {
        role: 'user',
        content: [
          'CONTEXTO COMERCIAL DA REUNIÃO ATÉ AGORA (JSON):',
          JSON.stringify(input.context),
          '',
          'Recomende a próxima ação do vendedor chamando recommend_next_best_action.',
        ].join('\n'),
      },
    ],
  })

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  if (!toolUse) return null

  return toolUse.input as NextBestAction
}
