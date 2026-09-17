'use server'

/**
 * Insights de IA sobre respostas de um formulário — extraído de
 * actions/forms-ai.ts (que passou do limite de 350 linhas do lint) pra
 * manter geração de schema e análise de respostas em arquivos separados.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getAccountIdForOrgSlug, consumeAiCredits } from '@/lib/plans/server'

async function requireFormsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'forms')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

const INSIGHTS_TOOL: any = {
  name: 'report_insights',
  description: 'Registra os insights extraídos das respostas do formulário.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '1-2 frases resumindo o desempenho geral do formulário.' },
      patterns: { type: 'array', items: { type: 'string' }, description: 'Padrões notados nas respostas (respostas mais comuns, tendências, correlações).' },
      suggestions: { type: 'array', items: { type: 'string' }, description: 'Sugestões acionáveis pra melhorar taxa de conversão ou qualidade das respostas.' },
    },
    required: ['summary', 'patterns', 'suggestions'],
  },
}

export type FormAiInsights = { summary: string; patterns: string[]; suggestions: string[] }

function buildFieldAnalysis(fields: any[], submissions: any[]) {
  return fields
    // PII pura (nome/telefone/e-mail) fica de fora da análise — só o
    // agregado de campos de segmentação/preferência importa aqui.
    .filter(f => !['email', 'phone'].includes(f.type))
    .map(f => {
      const values = submissions.map(s => s.data?.[f.id]).filter(v => v !== undefined && v !== null && v !== '')
      const isChoice = ['select', 'single_choice', 'multi_select', 'checkbox', 'rating', 'opinion_scale'].includes(f.type)
      if (isChoice) {
        const freq: Record<string, number> = {}
        for (const v of values) {
          const items = Array.isArray(v) ? v : [v]
          for (const item of items) freq[String(item)] = (freq[String(item)] || 0) + 1
        }
        return { label: f.label, type: f.type, distribution: freq }
      }
      // Texto livre — amostra pequena, nunca o dataset inteiro.
      const sample = values.slice(0, 15).map((v: any) => String(v).slice(0, 200))
      return { label: f.label, type: f.type, sample }
    })
}

/** Analisa as respostas já coletadas (agregadas por campo, sem dado bruto de
 *  contato) e devolve insights em texto. Sob demanda — não roda sozinho. */
export async function getFormAiInsights(
  orgSlug: string,
  formId: string,
): Promise<{ ok: true; insights: FormAiInsights } | { ok: false; error: string }> {
  const access = await requireFormsAccess(orgSlug)
  if (!access.ok) return access
  const { org } = access

  const { hasPlatformAiKey, resolveAnthropicEngine } = await import('@/lib/ai/api-key')
  if (!hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  const supabase = createClient()
  const { data: form } = await supabase
    .from('forms')
    .select('id, name, schema, created_at')
    .eq('id', formId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!form) return { ok: false, error: 'Formulário não encontrado.' }

  const { data: submissions, count } = await supabase
    .from('form_submissions')
    .select('data, created_at', { count: 'exact' })
    .eq('form_id', formId)
    .order('created_at', { ascending: false })
    .limit(300)

  if (!submissions || submissions.length === 0) {
    return { ok: false, error: 'Este formulário ainda não tem respostas suficientes pra gerar insights.' }
  }

  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (accountId) {
    const credit = await consumeAiCredits({ accountId, action: 'form_ai_insights', metadata: { feature: 'forms_ai', orgSlug } })
    if (!credit.success) {
      return {
        ok: false,
        error: credit.error === 'insufficient_credits'
          ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
          : 'Não foi possível validar seus créditos de IA. Tente novamente.',
      }
    }
  }

  const fields: any[] = (form.schema as any)?.fields ?? []
  const analysisByField = buildFieldAnalysis(fields, submissions as any[])

  const prompt = [
    `Formulário: "${form.name}"`,
    `Total de respostas (amostra analisada): ${submissions.length} de ${count ?? submissions.length}.`,
    '',
    'Dados agregados por campo:',
    JSON.stringify(analysisByField, null, 2),
  ].join('\n')

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const { apiKey, baseURL } = await resolveAnthropicEngine()
  const client = new Anthropic({ apiKey, ...(baseURL && { baseURL }) })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      system: 'Você analisa respostas de formulários de captação de um CRM brasileiro e devolve insights objetivos e acionáveis em português. Responda sempre com a ferramenta report_insights.',
      messages: [{ role: 'user', content: prompt }],
      tools: [INSIGHTS_TOOL],
      tool_choice: { type: 'tool', name: 'report_insights' },
    })

    const toolBlock = response.content.find((b): b is any => b.type === 'tool_use')
    if (!toolBlock) return { ok: false, error: 'IA não retornou insights.' }

    const input = toolBlock.input as any
    return {
      ok: true,
      insights: {
        summary: typeof input.summary === 'string' ? input.summary : '',
        patterns: Array.isArray(input.patterns) ? input.patterns.filter((p: any) => typeof p === 'string') : [],
        suggestions: Array.isArray(input.suggestions) ? input.suggestions.filter((s: any) => typeof s === 'string') : [],
      },
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao consultar IA.' }
  }
}
