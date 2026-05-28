/**
 * AI lead qualifier.
 * Pure function: takes lead context + org config, returns structured qualification.
 * Uses Claude tool use for guaranteed structured JSON output (no markdown wrapping).
 */

import Anthropic from '@anthropic-ai/sdk'
import { DEFAULT_QUALIFIER_PROMPT } from './qualifier-prompt'

export type QualifierInput = {
  lead: {
    name: string | null
    email: string | null
    phone: string | null
    source: string | null
    tags: string[] | null
    value_cents: number | null
    custom_fields: Record<string, any> | null
  }
  /** Optional form schema so the model knows what each custom_fields key means. */
  formSchema?: { fields: Array<{ id: string; label: string; type: string }> } | null
  /** UTM source/campaign, recent activity types, etc. */
  contextHints?: string[]
}

export type QualifierResult = {
  score: number    // 0–100
  tier: 'hot' | 'warm' | 'cold'
  reason: string
  tags: string[]
  concerns: string[]
}

export type QualifierConfig = {
  apiKey: string
  model: string
  systemPrompt?: string | null
  businessContext?: string | null
}

// Tool schema — tool_use guarantees Claude returns this exact shape (no markdown wrapping)
const QUALIFY_TOOL: Anthropic.Messages.Tool = {
  name: 'qualify_lead',
  description:
    'Qualifica um lead com score numérico, tier, resumo do raciocínio, tags úteis e objeções/preocupações.',
  input_schema: {
    type: 'object',
    properties: {
      score:    { type: 'integer',                             description: 'Score de 0 a 100' },
      tier:     { type: 'string', enum: ['hot', 'warm', 'cold'] },
      reason:   { type: 'string',                             description: 'Explicação do score em 1-2 frases em português' },
      tags:     { type: 'array', items: { type: 'string' },  description: 'Tags curtas úteis para o vendedor' },
      concerns: { type: 'array', items: { type: 'string' },  description: 'Objeções ou pontos de atenção' },
    },
    required: ['score', 'tier', 'reason', 'tags', 'concerns'],
  },
}

function formatLeadForModel(input: QualifierInput): string {
  const { lead, formSchema, contextHints } = input
  const lines: string[] = ['# Lead a qualificar', '']

  lines.push(`Nome: ${lead.name || '—'}`)
  lines.push(`E-mail: ${lead.email || '—'}`)
  lines.push(`Telefone: ${lead.phone || '—'}`)
  lines.push(`Origem: ${lead.source || '—'}`)
  if (lead.value_cents) lines.push(`Valor estimado: R$ ${(lead.value_cents / 100).toFixed(2)}`)
  if (lead.tags?.length) lines.push(`Tags atuais: ${lead.tags.join(', ')}`)

  // Decode custom_fields using form schema labels when available
  if (lead.custom_fields && Object.keys(lead.custom_fields).length > 0) {
    lines.push('', '## Respostas do formulário')
    const fieldLabel = new Map<string, string>()
    for (const f of formSchema?.fields || []) fieldLabel.set(f.id, f.label)
    for (const [k, v] of Object.entries(lead.custom_fields)) {
      const label = fieldLabel.get(k) || k
      const value = Array.isArray(v) ? v.join(', ') : String(v ?? '')
      lines.push(`- ${label}: ${value}`)
    }
  }

  if (contextHints?.length) {
    lines.push('', '## Contexto adicional')
    for (const h of contextHints) lines.push(`- ${h}`)
  }

  return lines.join('\n')
}

/**
 * Calls Claude with tool use for guaranteed structured output.
 * Returns the parsed qualification + raw usage for cost tracking.
 * Throws on API errors so the caller decides retry policy.
 */
export async function qualifyLead(
  input: QualifierInput,
  config: QualifierConfig,
): Promise<{ result: QualifierResult; usage: Anthropic.Messages.Usage; modelUsed: string }> {
  const client = new Anthropic({ apiKey: config.apiKey })

  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: 'text',
      text: config.systemPrompt || DEFAULT_QUALIFIER_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
  ]
  if (config.businessContext?.trim()) {
    systemBlocks.push({
      type: 'text',
      text: `\n\n## Contexto do negócio\n${config.businessContext.trim()}`,
    })
  }

  const userMessage = formatLeadForModel(input)

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 800,
    system: systemBlocks,
    messages: [{ role: 'user', content: userMessage }],
    tools: [QUALIFY_TOOL],
    // Force Claude to call qualify_lead — guarantees structured output, no markdown
    tool_choice: { type: 'tool', name: 'qualify_lead' },
  } as any) // `as any` needed for cache_control on system blocks (beta field)

  // With tool_choice forced, the first content block is always a tool_use block
  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('IA não retornou bloco de tool_use')

  const parsed = toolBlock.input as any

  // Clamp + validate (numerical constraints not enforced by schema)
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
  const tier: QualifierResult['tier'] =
    parsed.tier === 'hot' || parsed.tier === 'warm' || parsed.tier === 'cold'
      ? parsed.tier
      : score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold'
  const tags     = Array.isArray(parsed.tags)     ? (parsed.tags     as string[]).filter(t => typeof t === 'string').slice(0, 10) : []
  const concerns = Array.isArray(parsed.concerns) ? (parsed.concerns as string[]).filter(c => typeof c === 'string').slice(0, 10) : []
  const reason   = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 500) : ''

  return {
    result: { score, tier, reason, tags, concerns },
    usage: response.usage,
    modelUsed: response.model,
  }
}
