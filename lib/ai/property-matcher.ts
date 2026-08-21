/**
 * AI property matcher (Vertical Imobiliárias, Fase 4).
 * Pure function: takes a lead + preferences + pre-filtered candidate
 * properties, returns a ranked list with score + reason per property.
 * Mesmo molde de lib/ai/qualifier.ts — tool_choice forçado pra garantir
 * JSON estruturado, sem parse de markdown. Só Claude nesta fase (sem
 * paridade Gemini, o qualificador de lead suporta os dois mas o prompt
 * original não pede isso pra matching).
 */

import Anthropic from '@anthropic-ai/sdk'

export type MatcherCandidate = {
  id: string
  title: string
  code: string | null
  propertyType: string | null
  purpose: string
  priceCents: number | null
  city: string | null
  neighborhood: string | null
  bedrooms: number | null
  parkingSpots: number | null
  features: string[] | null
}

export type MatcherInput = {
  lead: {
    name: string | null
    preferences: Record<string, any> | null
  }
  candidates: MatcherCandidate[]
}

export type MatchedProperty = { propertyId: string; score: number; reason: string }

export type MatcherConfig = {
  apiKey: string
  model: string
}

const MATCH_TOOL: Anthropic.Messages.Tool = {
  name: 'rank_properties',
  description:
    'Classifica os imóveis candidatos por compatibilidade com o lead, do mais pro menos compatível.',
  input_schema: {
    type: 'object',
    properties: {
      matches: {
        type: 'array',
        description: 'Lista de imóveis avaliados, ordenada por score decrescente.',
        items: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', description: 'id do imóvel, exatamente como recebido' },
            score: { type: 'integer', description: 'Compatibilidade de 0 a 100' },
            reason: { type: 'string', description: 'Motivo em 1 frase, em português' },
          },
          required: ['propertyId', 'score', 'reason'],
        },
      },
    },
    required: ['matches'],
  },
}

function normalizeMatches(parsed: any, validIds: Set<string>): MatchedProperty[] {
  const arr = Array.isArray(parsed?.matches) ? parsed.matches : []
  return arr
    .filter((m: any) => m && typeof m.propertyId === 'string' && validIds.has(m.propertyId))
    .map((m: any) => ({
      propertyId: m.propertyId as string,
      score: Math.max(0, Math.min(100, Math.round(Number(m.score) || 0))),
      reason: typeof m.reason === 'string' ? m.reason.slice(0, 300) : '',
    }))
    .sort((a: MatchedProperty, b: MatchedProperty) => b.score - a.score)
}

function formatForModel(input: MatcherInput): string {
  const { lead, candidates } = input
  const lines: string[] = ['# Lead', '']
  lines.push(`Nome: ${lead.name || '—'}`)

  if (lead.preferences && Object.keys(lead.preferences).length > 0) {
    lines.push('', '## Preferências informadas')
    const p = lead.preferences
    if (p.purpose) lines.push(`- Finalidade: ${p.purpose}`)
    if (p.priceMin) lines.push(`- Preço mínimo: R$ ${(p.priceMin / 100).toFixed(2)}`)
    if (p.priceMax) lines.push(`- Preço máximo: R$ ${(p.priceMax / 100).toFixed(2)}`)
    if (p.bedroomsMin) lines.push(`- Dormitórios mínimo: ${p.bedroomsMin}`)
    if (p.city) lines.push(`- Cidade: ${p.city}`)
    if (p.neighborhood) lines.push(`- Bairro: ${p.neighborhood}`)
    if (p.propertyType) lines.push(`- Tipo de imóvel: ${p.propertyType}`)
    if (p.notes) lines.push(`- Observações: ${p.notes}`)
  } else {
    lines.push('', 'Nenhuma preferência estruturada informada — avalie pelos imóveis mais gerais/atrativos do lote.')
  }

  lines.push('', '# Imóveis candidatos', '')
  for (const c of candidates) {
    lines.push(`## ${c.id}`)
    lines.push(`Título: ${c.title}${c.code ? ` (${c.code})` : ''}`)
    lines.push(`Tipo: ${c.propertyType || '—'} · Finalidade: ${c.purpose}`)
    if (c.priceCents != null) lines.push(`Preço: R$ ${(c.priceCents / 100).toFixed(2)}`)
    lines.push(`Local: ${[c.neighborhood, c.city].filter(Boolean).join(', ') || '—'}`)
    if (c.bedrooms != null) lines.push(`Dormitórios: ${c.bedrooms}`)
    if (c.parkingSpots != null) lines.push(`Vagas: ${c.parkingSpots}`)
    if (c.features?.length) lines.push(`Características: ${c.features.join(', ')}`)
    lines.push('')
  }

  return lines.join('\n')
}

export async function matchProperties(
  input: MatcherInput,
  config: MatcherConfig,
): Promise<{ result: MatchedProperty[]; usage: Anthropic.Messages.Usage; modelUsed: string }> {
  const client = new Anthropic({ apiKey: config.apiKey })
  const validIds = new Set(input.candidates.map(c => c.id))

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: 'Você é um corretor de imóveis experiente ajudando a priorizar quais imóveis do estoque apresentar a um lead específico, com base nas preferências dele. Seja direto e prático.',
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: formatForModel(input) }],
    tools: [MATCH_TOOL],
    tool_choice: { type: 'tool', name: 'rank_properties' },
  } as any)

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('IA não retornou bloco de tool_use')

  return {
    result: normalizeMatches(toolBlock.input, validIds),
    usage: response.usage,
    modelUsed: response.model,
  }
}
