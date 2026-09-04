'use server'

/**
 * AI category suggestion for financial entries. Split out of
 * actions/financial-entries.ts.
 *
 * Classificação de texto simples (descrição → categoria), sem OCR/visão.
 * Usa o token centralizado da plataforma (lib/ai/api-key.ts), mesmo
 * modelo usado no qualificador de leads.
 */

import { getCurrentOrganization } from '@/lib/supabase/types'

const CATEGORY_EXAMPLES_BY_NICHE: Record<string, string> = {
  travel: '"Comissão", "Marketing", "Passagens aéreas", "Reembolso", "Taxas bancárias"',
  clinic: '"Comissão de profissional", "Insumos", "Aluguel da clínica", "Marketing", "Taxas de cartão", "Materiais e equipamentos"',
  real_estate: '"Comissão de corretor", "Marketing de imóveis", "Taxas de cartório", "Manutenção de imóvel", "Aluguel do escritório"',
  generic: '"Comissão", "Marketing", "Fornecedores", "Taxas bancárias", "Reembolso"',
}

const BUSINESS_LABEL_BY_NICHE: Record<string, string> = {
  travel: 'agência de viagens',
  clinic: 'clínica',
  real_estate: 'imobiliária',
  generic: 'empresa',
}

export async function suggestCategoryForEntry(
  orgSlug: string,
  input: { descricao: string; tipo: 'receita' | 'despesa' },
): Promise<{ ok: true; categoria: string; confidence: number } | { ok: false; error: string }> {
  const org = await getCurrentOrganization(orgSlug)

  if (!input.descricao?.trim()) return { ok: false, error: 'Informe uma descrição para sugerir a categoria.' }

  const { getPlatformAiKey, hasPlatformAiKey } = await import('@/lib/ai/api-key')
  if (!hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  const { copilotNicheFor } = await import('@/lib/ai/insights-tools')
  const niche = copilotNicheFor((org as any).niche)
  const businessLabel = BUSINESS_LABEL_BY_NICHE[niche]
  const examples = CATEGORY_EXAMPLES_BY_NICHE[niche]

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: getPlatformAiKey() })

  const CATEGORIZE_TOOL: any = {
    name: 'categorize_entry',
    description: `Sugere a categoria financeira mais provável para um lançamento de ${businessLabel}.`,
    input_schema: {
      type: 'object',
      properties: {
        categoria: { type: 'string', description: `Nome curto da categoria sugerida, ex.: ${examples}` },
        confidence: { type: 'number', description: 'Confiança de 0 a 1' },
      },
      required: ['categoria', 'confidence'],
    },
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `Você categoriza lançamentos financeiros de uma ${businessLabel} brasileira. Responda sempre com a ferramenta categorize_entry.`,
      messages: [{
        role: 'user',
        content: `Tipo: ${input.tipo}\nDescrição: ${input.descricao.trim()}`,
      }],
      tools: [CATEGORIZE_TOOL],
      tool_choice: { type: 'tool', name: 'categorize_entry' },
    })

    const toolBlock = response.content.find((b): b is any => b.type === 'tool_use')
    if (!toolBlock) return { ok: false, error: 'IA não retornou sugestão.' }

    const categoria = typeof toolBlock.input.categoria === 'string' ? toolBlock.input.categoria.slice(0, 60) : ''
    const confidence = Math.max(0, Math.min(1, Number(toolBlock.input.confidence) || 0))
    if (!categoria) return { ok: false, error: 'IA não retornou categoria.' }

    return { ok: true, categoria, confidence }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao consultar IA.' }
  }
}
