/**
 * Gera resumo/insights/Call Score de uma ligação a partir da transcrição —
 * mesmo padrão de extração estruturada de lib/ai/document-extract-claude.ts
 * (tool forçado, sem parse de texto livre).
 */
import Anthropic from '@anthropic-ai/sdk'
import { getPlatformAiKey } from '../ai/api-key'

const INSIGHTS_TOOL: Anthropic.Messages.Tool = {
  name: 'extract_call_insights',
  description: 'Registra o resumo e os insights estruturados de uma ligação de vendas/atendimento.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      intent: { type: 'string', description: 'Motivo/intenção principal da ligação' },
      sentiment: { type: 'string', enum: ['positivo', 'neutro', 'negativo'] },
      interest_level: { type: 'string', enum: ['alto', 'medio', 'baixo'] },
      objections: { type: 'array', items: { type: 'string' } },
      competitors: { type: 'array', items: { type: 'string' } },
      values_mentioned: { type: 'array', items: { type: 'string' } },
      dates_mentioned: { type: 'array', items: { type: 'string' } },
      products_mentioned: { type: 'array', items: { type: 'string' } },
      commitments: { type: 'array', items: { type: 'string' } },
      suggested_tasks: { type: 'array', items: { type: 'string' } },
      next_steps: { type: 'string' },
      outcome: {
        type: 'string',
        enum: ['qualificado', 'agendamento_realizado', 'venda_realizada', 'retorno_solicitado', 'nao_atendeu', 'caixa_postal', 'numero_invalido', 'sem_interesse', 'transferido_para_humano', 'follow_up', 'outro'],
      },
      call_score: { type: 'integer', description: '0 a 100 — qualidade geral da condução da ligação' },
      call_score_breakdown: {
        type: 'object',
        properties: {
          identificacao: { type: 'integer' }, descoberta: { type: 'integer' }, clareza: { type: 'integer' },
          levantamento_necessidade: { type: 'integer' }, quebra_objecoes: { type: 'integer' }, cta: { type: 'integer' }, follow_up: { type: 'integer' },
        },
      },
    },
    required: ['summary', 'intent', 'sentiment', 'interest_level', 'objections', 'next_steps', 'outcome', 'call_score'],
  },
}

export interface CallInsights {
  summary: string
  intent: string
  sentiment: string
  interest_level: string
  objections: string[]
  competitors: string[]
  values_mentioned: string[]
  dates_mentioned: string[]
  products_mentioned: string[]
  commitments: string[]
  suggested_tasks: string[]
  next_steps: string
  outcome: string
  call_score: number
  call_score_breakdown: Record<string, number>
}

export async function generateCallInsights(transcriptText: string): Promise<CallInsights> {
  const client = new Anthropic({ apiKey: getPlatformAiKey() })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    system: 'Você analisa transcrições de ligações de vendas/atendimento em português do Brasil e extrai resumo e insights estruturados. Use SEMPRE a ferramenta extract_call_insights. O Call Score é uma ferramenta de coaching para a equipe, nunca um julgamento definitivo — seja justo e construtivo.',
    messages: [{ role: 'user', content: `Transcrição da ligação:\n\n${transcriptText}` }],
    tools: [INSIGHTS_TOOL],
    tool_choice: { type: 'tool', name: 'extract_call_insights' },
  })

  const toolBlock = response.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
  if (!toolBlock) throw new Error('IA não retornou bloco de tool_use')
  return toolBlock.input as CallInsights
}
