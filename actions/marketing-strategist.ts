'use server'

/**
 * Althos Marketing Strategist — agente de IA que sugere um plano de mídia
 * estruturado (mesmo schema de actions/media-plans.ts) a partir de:
 * Inteligência do Cliente (traffic_client_profile), Método da Agência
 * (organizations.trafego_agency_method), performance real dos últimos 30
 * dias e campanhas/criativos já existentes.
 *
 * A saída SEMPRE preenche a estrutura editável do plano de mídia — nunca um
 * texto solto — e nunca é salva automaticamente: o usuário revisa, edita e
 * só então aplica (cria uma nova versão do plano), pelo mesmo fluxo manual
 * de actions/media-plans.ts (createMediaPlan/createMediaPlanItem), sem
 * duplicar essa lógica de persistência.
 */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { createClient } from '@/lib/supabase/server'
import { getAccountIdForOrgSlug, consumeAiCredits } from '@/lib/plans/server'
import { getTrafficClientProfile } from '@/actions/traffic-client-profile'
import { getAgencyMethod } from '@/actions/agency-method'
import { getClientPerformanceComparison } from '@/actions/trafego-performance'
import { createMediaPlan, createMediaPlanItem, type MediaPlanPlatform, type MediaPlanFunnelStage, type MediaPlanBudgetType } from '@/actions/media-plans'

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type StrategistAdSuggestion = { name: string; config: Record<string, string> }
export type StrategistAdsetSuggestion = { name: string; objective: string | null; budget_cents: number | null; budget_type: MediaPlanBudgetType | null; config: Record<string, string>; ads: StrategistAdSuggestion[] }
export type StrategistCampaignSuggestion = {
  platform: MediaPlanPlatform
  funnel_stage: MediaPlanFunnelStage | null
  name: string
  objective: string | null
  budget_cents: number | null
  budget_type: MediaPlanBudgetType | null
  config: Record<string, string>
  adsets: StrategistAdsetSuggestion[]
}
export type MediaPlanSuggestion = {
  name: string
  objective_primary: string | null
  budget_total_cents: number | null
  target_leads: number | null
  target_cpl_cents: number | null
  target_roas: number | null
  notes: string | null
  platform_budgets: Record<string, number>
  campaigns: StrategistCampaignSuggestion[]
}

const PLATFORMS: MediaPlanPlatform[] = ['meta', 'google', 'tiktok', 'linkedin', 'gpt_ads', 'other']
const FUNNEL_STAGES: MediaPlanFunnelStage[] = ['topo', 'meio', 'fundo']
const BUDGET_TYPES: MediaPlanBudgetType[] = ['daily', 'lifetime']

const PROPOSE_MEDIA_PLAN_TOOL = {
  name: 'propose_media_plan',
  description: 'Registra a sugestão completa de plano de mídia estruturado — objetivo, orçamento, metas, e a árvore campanha→conjunto→anúncio.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      objective_primary: { type: 'string' },
      budget_total_cents: { type: 'integer' },
      target_leads: { type: 'integer' },
      target_cpl_cents: { type: 'integer' },
      target_roas: { type: 'number' },
      notes: { type: 'string', description: 'Racional da sugestão em 2-4 frases.' },
      platform_budgets: { type: 'object', additionalProperties: { type: 'integer' } },
      campaigns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: PLATFORMS },
            funnel_stage: { type: 'string', enum: FUNNEL_STAGES },
            name: { type: 'string' },
            objective: { type: 'string' },
            budget_cents: { type: 'integer' },
            budget_type: { type: 'string', enum: BUDGET_TYPES },
            config: { type: 'object', additionalProperties: { type: 'string' }, description: 'bid_strategy, optimization_event, conversion_objective (Meta) ou campaign_type, network (Google), etc.' },
            adsets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  objective: { type: 'string' },
                  budget_cents: { type: 'integer' },
                  budget_type: { type: 'string', enum: BUDGET_TYPES },
                  config: { type: 'object', additionalProperties: { type: 'string' } },
                  ads: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        config: { type: 'object', additionalProperties: { type: 'string' }, description: 'headline, description, cta, format, copy' },
                      },
                      required: ['name'],
                    },
                  },
                },
                required: ['name', 'ads'],
              },
            },
          },
          required: ['platform', 'name', 'adsets'],
        },
      },
    },
    required: ['name', 'campaigns'],
  },
} as const

async function spendStrategistCredit(orgSlug: string) {
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: true as const }
  const credit = await consumeAiCredits({ accountId, action: 'marketing_strategist_generate', metadata: { feature: 'marketing_strategist', orgSlug } })
  if (!credit.success) {
    return {
      ok: false as const,
      error: credit.error === 'insufficient_credits'
        ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
        : 'Não foi possível validar seus créditos de IA. Tente novamente.',
    }
  }
  return { ok: true as const }
}

export async function generateMediaPlanSuggestion(
  orgSlug: string,
  contatoId: string,
  briefing?: string,
): Promise<{ ok: true; suggestion: MediaPlanSuggestion } | { ok: false; error: string }> {
  const { org } = await requireAccess(orgSlug)

  const { hasPlatformAiKey, resolveAnthropicEngine } = await import('@/lib/ai/api-key')
  if (!hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  const credit = await spendStrategistCredit(orgSlug)
  if (!credit.ok) return credit

  const supabase = createClient()
  const [{ data: client }, profile, agencyMethod] = await Promise.all([
    supabase.from('contatos').select('name').eq('id', contatoId).eq('organization_id', org.id).maybeSingle(),
    getTrafficClientProfile(orgSlug, contatoId),
    getAgencyMethod(orgSlug),
  ])
  if (!client) return { ok: false, error: 'Cliente não encontrado' }

  const now = new Date()
  const range30d = { from: new Date(now.getTime() - 29 * 86_400_000), to: now }
  const { current } = await getClientPerformanceComparison(orgSlug, contatoId, range30d)

  const context = {
    cliente: client.name,
    inteligencia_do_cliente: profile || 'Nenhum perfil preenchido ainda.',
    metodo_da_agencia: agencyMethod || 'Nenhum método configurado ainda — use boas práticas gerais de tráfego pago.',
    performance_ultimos_30_dias: current,
    briefing_adicional: briefing || null,
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const { apiKey, baseURL } = await resolveAnthropicEngine()
  const client_ = new Anthropic({ apiKey, ...(baseURL && { baseURL }) })

  try {
    const response = await client_.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      system:
        'Você é o Althos Marketing Strategist, um estrategista de tráfego pago sênior. ' +
        'Com base no contexto do cliente (Inteligência do Cliente, Método da Agência e performance real) fornecido pelo usuário, ' +
        'proponha um plano de mídia completo pro próximo período (assuma 30 dias se não especificado). ' +
        'Nunca invente números de performance — baseie orçamento e metas no histórico real quando houver, ' +
        'e em benchmarks de mercado razoáveis quando não houver. Sempre use a tool propose_media_plan.',
      messages: [{ role: 'user', content: JSON.stringify(context) }],
      tools: [PROPOSE_MEDIA_PLAN_TOOL as any],
      tool_choice: { type: 'tool', name: 'propose_media_plan' },
    })

    const toolBlock = response.content.find((b): b is any => b.type === 'tool_use')
    if (!toolBlock) return { ok: false, error: 'IA não retornou uma sugestão.' }

    const input = toolBlock.input as any
    const suggestion: MediaPlanSuggestion = {
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Sugestão do Marketing Strategist',
      objective_primary: input.objective_primary ?? null,
      budget_total_cents: Number.isFinite(input.budget_total_cents) ? input.budget_total_cents : null,
      target_leads: Number.isFinite(input.target_leads) ? input.target_leads : null,
      target_cpl_cents: Number.isFinite(input.target_cpl_cents) ? input.target_cpl_cents : null,
      target_roas: Number.isFinite(input.target_roas) ? input.target_roas : null,
      notes: typeof input.notes === 'string' ? input.notes : null,
      platform_budgets: typeof input.platform_budgets === 'object' && input.platform_budgets ? input.platform_budgets : {},
      campaigns: Array.isArray(input.campaigns) ? input.campaigns.map(normalizeCampaign) : [],
    }
    if (suggestion.campaigns.length === 0) return { ok: false, error: 'IA não retornou nenhuma campanha estruturada.' }

    return { ok: true, suggestion }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao consultar IA.' }
  }
}

function normalizeCampaign(c: any): StrategistCampaignSuggestion {
  return {
    platform: PLATFORMS.includes(c?.platform) ? c.platform : 'meta',
    funnel_stage: FUNNEL_STAGES.includes(c?.funnel_stage) ? c.funnel_stage : null,
    name: typeof c?.name === 'string' ? c.name : 'Campanha',
    objective: typeof c?.objective === 'string' ? c.objective : null,
    budget_cents: Number.isFinite(c?.budget_cents) ? c.budget_cents : null,
    budget_type: BUDGET_TYPES.includes(c?.budget_type) ? c.budget_type : null,
    config: typeof c?.config === 'object' && c.config ? c.config : {},
    adsets: Array.isArray(c?.adsets) ? c.adsets.map(normalizeAdset) : [],
  }
}
function normalizeAdset(a: any): StrategistAdsetSuggestion {
  return {
    name: typeof a?.name === 'string' ? a.name : 'Conjunto',
    objective: typeof a?.objective === 'string' ? a.objective : null,
    budget_cents: Number.isFinite(a?.budget_cents) ? a.budget_cents : null,
    budget_type: BUDGET_TYPES.includes(a?.budget_type) ? a.budget_type : null,
    config: typeof a?.config === 'object' && a.config ? a.config : {},
    ads: Array.isArray(a?.ads) ? a.ads.map((d: any) => ({ name: typeof d?.name === 'string' ? d.name : 'Anúncio', config: typeof d?.config === 'object' && d.config ? d.config : {} })) : [],
  }
}

/** Cria um novo plano de mídia (nova versão) a partir de uma sugestão já
 *  revisada pelo usuário — reaproveita createMediaPlan/createMediaPlanItem,
 *  nunca insere direto na tabela. */
export async function applyMediaPlanSuggestion(orgSlug: string, contatoId: string, suggestion: MediaPlanSuggestion) {
  await requireAccess(orgSlug)

  const planRes = await createMediaPlan(orgSlug, contatoId, {
    name: suggestion.name,
    objective_primary: suggestion.objective_primary,
    budget_total_cents: suggestion.budget_total_cents,
    target_leads: suggestion.target_leads,
    target_cpl_cents: suggestion.target_cpl_cents,
    target_roas: suggestion.target_roas,
    notes: suggestion.notes ? `[Gerado pelo Marketing Strategist] ${suggestion.notes}` : null,
    platform_budgets: suggestion.platform_budgets,
  })
  if (!planRes.ok) return planRes

  for (const [ci, campaign] of Array.from(suggestion.campaigns.entries())) {
    const campaignRes = await createMediaPlanItem(orgSlug, {
      media_plan_id: planRes.id, parent_id: null, level: 'campaign', platform: campaign.platform,
      funnel_stage: campaign.funnel_stage, name: campaign.name, objective: campaign.objective,
      budget_cents: campaign.budget_cents, budget_type: campaign.budget_type, config: campaign.config, order_index: ci,
    })
    if (!campaignRes.ok) continue

    for (const [ai, adset] of Array.from(campaign.adsets.entries())) {
      const adsetRes = await createMediaPlanItem(orgSlug, {
        media_plan_id: planRes.id, parent_id: campaignRes.id, level: 'adset', platform: campaign.platform,
        name: adset.name, objective: adset.objective, budget_cents: adset.budget_cents, budget_type: adset.budget_type,
        config: adset.config, order_index: ai,
      })
      if (!adsetRes.ok) continue

      for (const [di, ad] of Array.from(adset.ads.entries())) {
        await createMediaPlanItem(orgSlug, {
          media_plan_id: planRes.id, parent_id: adsetRes.id, level: 'ad', platform: campaign.platform,
          name: ad.name, config: ad.config, order_index: di,
        })
      }
    }
  }

  return { ok: true as const, id: planRes.id }
}
