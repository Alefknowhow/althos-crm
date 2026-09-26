import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { AgentContext } from '@/lib/agent/context'
import type { ToolDef } from '@/lib/agent/execute'
import { getAdsAdapter, resolveAdsToken, AdsCapabilityError } from '@/lib/ads'
import { getClientPerformanceSummaryCore } from '@/actions/trafego-performance'
import { computeClientAlerts } from '@/lib/trafego/alerts'
import { computeClientHealthStatus } from '@/lib/trafego/health-status'

/** Duplicado de lib/agent/tools/clients.ts por design (mesmo padrão já
 *  usado em lib/agent/tools/library.ts) — evita acoplamento entre
 *  arquivos de tools. */
async function resolveClient(ctx: AgentContext, client: string): Promise<{ id: string; name: string } | null> {
  const supabase = createAdminClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client)
  if (isUuid) {
    const { data } = await supabase.from('contatos').select('id, name')
      .eq('id', client).eq('organization_id', ctx.orgId).eq('status', 'cliente').maybeSingle()
    return data
  }
  const { data } = await supabase.from('contatos').select('id, name')
    .eq('organization_id', ctx.orgId).eq('status', 'cliente')
    .ilike('name', `%${client}%`).limit(1).maybeSingle()
  return data
}

/** Confirma que uma campanha/ad set pertence a uma conta de anúncio de um
 *  contato **desta org** antes de chamar o adapter — nunca aceita um id
 *  externo "solto" vindo do agente. */
async function resolveCampaignAccount(ctx: AgentContext, campaignId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('campaigns')
    .select('id, external_id, ad_accounts!inner(id, provider, organization_id, external_id)')
    .eq('id', campaignId)
    .eq('organization_id', ctx.orgId)
    .maybeSingle()
  const account = (data as any)?.ad_accounts
  if (!data?.external_id || !account) return null
  return { campaignExternalId: data.external_id, provider: account.provider as 'meta' | 'google' }
}

export const getAdAccountInsightsShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
  days: z.number().int().min(1).max(90).optional().describe('Janela de dias (padrão 30)'),
}

export const getAdAccountInsightsTool: ToolDef<{ client: string; days?: number }> = {
  name: 'get_ad_account_insights',
  description: 'Investimento, impressões, cliques, leads, vendas, receita e ROAS de um cliente de tráfego num período (dados agregados da conta de anúncio + vendas reais).',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const supabase = createAdminClient()
    const days = input.days ?? 30
    const now = new Date()
    const range = { from: new Date(now.getTime() - (days - 1) * 86_400_000), to: now }
    const summary = await getClientPerformanceSummaryCore(supabase, ctx.orgId, resolved.id, range)
    return { client: resolved.name, days, ...summary }
  },
}

export const getAdSetsShape = {
  campaignId: z.string().describe('ID interno (UUID) da campanha, não o external_id da Meta'),
}

export const getAdSetsTool: ToolDef<{ campaignId: string }> = {
  name: 'get_adsets',
  description: 'Lista os Conjuntos de Anúncios de uma campanha, com métricas dos últimos 30 dias — ao vivo na Meta. Só funciona pra contas Meta com token válido.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveCampaignAccount(ctx, input.campaignId)
    if (!resolved) throw new Error('Campanha não encontrada nesta organização')
    const adapter = getAdsAdapter(resolved.provider)
    if (!adapter.capabilities.readAdSets) return { supported: false, reason: `Provider "${resolved.provider}" não suporta leitura de conjuntos de anúncios` }
    const supabaseAdmin = createAdminClient()
    const token = await resolveAdsToken(supabaseAdmin, ctx.orgId, resolved.provider)
    if (!token) return { supported: true, error: 'Token da conta de anúncio ausente ou expirado' }
    try {
      const adSets = await adapter.fetchAdSets!(resolved.campaignExternalId, token)
      return { supported: true, adSets }
    } catch (e: any) {
      if (e instanceof AdsCapabilityError) return { supported: false, reason: e.message }
      throw e
    }
  },
}

export const getAdsShape = {
  adSetExternalId: z.string().describe('ID externo (Meta) do conjunto de anúncios, obtido via get_adsets'),
  client: z.string().describe('ID (UUID) ou nome do cliente — usado só pra resolver a org/token'),
}

export const getAdsTool: ToolDef<{ adSetExternalId: string; client: string }> = {
  name: 'get_ads',
  description: 'Lista os Anúncios de um Conjunto de Anúncios (Meta), ao vivo. Use get_adsets primeiro para obter o adSetExternalId.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const adapter = getAdsAdapter('meta')
    const supabaseAdmin = createAdminClient()
    const token = await resolveAdsToken(supabaseAdmin, ctx.orgId, 'meta')
    if (!token) return { error: 'Token da conta de anúncio ausente ou expirado' }
    const ads = await adapter.fetchAds!(input.adSetExternalId, token)
    return { ads }
  },
}

export const getClientAlertsShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
}

export const getClientAlertsTool: ToolDef<{ client: string }> = {
  name: 'get_client_alerts',
  description: 'Alertas e status de saúde da operação de um cliente (CPL/ROAS acima/abaixo da meta, queda de leads, CPM anormal, conta sem sincronizar) — a mesma análise mostrada no painel.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const supabase = createAdminClient()
    const now = new Date()
    const range = { from: new Date(now.getTime() - 29 * 86_400_000), to: now }
    const prevRange = { from: new Date(range.from.getTime() - 30 * 86_400_000), to: new Date(range.from.getTime() - 1) }
    const [current, previous, { data: profileRow }, { data: accounts }] = await Promise.all([
      getClientPerformanceSummaryCore(supabase, ctx.orgId, resolved.id, range),
      getClientPerformanceSummaryCore(supabase, ctx.orgId, resolved.id, prevRange),
      supabase.from('contatos').select('traffic_client_profile').eq('id', resolved.id).maybeSingle(),
      supabase.from('ad_accounts').select('updated_at, created_at').eq('organization_id', ctx.orgId).eq('contato_id', resolved.id),
    ])
    const lastSyncedAt = (accounts || []).map(a => a.updated_at || a.created_at).filter(Boolean).sort().pop() as string | undefined
    const lastSyncDaysAgo = lastSyncedAt ? Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000) : null
    const profile = (profileRow as any)?.traffic_client_profile ?? null
    const alerts = computeClientAlerts(current, previous, profile, lastSyncDaysAgo)
    const health = computeClientHealthStatus({
      investmentCents: current.investmentCents,
      cplCents: current.cplCents,
      targetCpl: profile?.targetCpl ?? null,
      roas: current.roas,
      targetRoas: profile?.targetRoas ?? null,
    })
    return { client: resolved.name, health, alerts }
  },
}

export const getSearchTermsShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
}

export const getSearchTermsTool: ToolDef<{ client: string }> = {
  name: 'get_search_terms',
  description: 'Termos de busca que geraram impressão/clique (só Google Search Ads). Hoje não suportado por nenhum provider conectado.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    return { supported: false, reason: 'Nenhum provider conectado suporta leitura de termos de busca ainda (Meta não expõe; Google Ads sem integração)' }
  },
}

export const listMediaPlanShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
}

// ── Mutation tools (#22, passo 3.8) — requiresApproval:true sempre; a
// capability real (pauseCampaign/updateBudget) só é true com
// META_ADS_WRITE_ENABLED=true (não setada em produção), então mesmo depois
// de aprovadas, o handler abaixo retorna erro claro em vez de silenciosamente
// não fazer nada. checkAdsPolicyForMutation roda ANTES do handler tentar
// qualquer chamada real — nunca confia no que o agente "decidiu".

export const pauseCampaignShape = {
  campaignId: z.string().describe('ID interno (UUID) da campanha, não o external_id da Meta'),
}

export const pauseCampaignTool: ToolDef<{ campaignId: string }> = {
  name: 'ads_pause_campaign',
  description: 'Pausa uma campanha na Meta. Exige aprovação humana antes de executar — a mudança só acontece de fato depois de revisada em Configurações → Aprovações.',
  riskLevel: 'HIGH',
  requiresApproval: true,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveCampaignAccount(ctx, input.campaignId)
    if (!resolved) throw new Error('Campanha não encontrada nesta organização')
    const adapter = getAdsAdapter(resolved.provider)
    const supabaseAdmin = createAdminClient()
    const { checkAdsPolicyForMutation } = await import('@/actions/ads-policies')
    const policy = await checkAdsPolicyForMutation(supabaseAdmin, ctx.orgId, 'pause')
    if (!policy.allowed) throw new Error(policy.reason)
    if (!adapter.capabilities.pauseCampaign || !adapter.pauseCampaign) {
      throw new Error('Escrita na Meta não habilitada (requer permissão ads_management + App Review + META_ADS_WRITE_ENABLED=true)')
    }
    const token = await resolveAdsToken(supabaseAdmin, ctx.orgId, resolved.provider)
    if (!token) throw new Error('Token da conta de anúncio ausente ou expirado')
    const result = await adapter.pauseCampaign(resolved.campaignExternalId, token)
    if (!result.ok) throw new Error(result.error)
    return result
  },
}

export const resumeCampaignTool: ToolDef<{ campaignId: string }> = {
  name: 'ads_resume_campaign',
  description: 'Retoma (ACTIVE) uma campanha pausada na Meta. Exige aprovação humana antes de executar.',
  riskLevel: 'HIGH',
  requiresApproval: true,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveCampaignAccount(ctx, input.campaignId)
    if (!resolved) throw new Error('Campanha não encontrada nesta organização')
    const adapter = getAdsAdapter(resolved.provider)
    const supabaseAdmin = createAdminClient()
    const { checkAdsPolicyForMutation } = await import('@/actions/ads-policies')
    const policy = await checkAdsPolicyForMutation(supabaseAdmin, ctx.orgId, 'resume')
    if (!policy.allowed) throw new Error(policy.reason)
    if (!adapter.capabilities.resumeCampaign || !adapter.resumeCampaign) {
      throw new Error('Escrita na Meta não habilitada (requer permissão ads_management + App Review + META_ADS_WRITE_ENABLED=true)')
    }
    const token = await resolveAdsToken(supabaseAdmin, ctx.orgId, resolved.provider)
    if (!token) throw new Error('Token da conta de anúncio ausente ou expirado')
    const result = await adapter.resumeCampaign(resolved.campaignExternalId, token)
    if (!result.ok) throw new Error(result.error)
    return result
  },
}

export const updateBudgetShape = {
  adSetExternalId: z.string().describe('ID externo (Meta) do conjunto de anúncios'),
  client: z.string().describe('ID (UUID) ou nome do cliente — usado só pra resolver a org/token'),
  dailyBudgetCents: z.number().int().min(100).describe('Novo orçamento diário em centavos'),
  currentDailyBudgetCents: z.number().int().min(0).describe('Orçamento diário atual, em centavos — usado só pra checar o limite de variação da política'),
}

export const updateBudgetTool: ToolDef<{ adSetExternalId: string; client: string; dailyBudgetCents: number; currentDailyBudgetCents: number }> = {
  name: 'ads_update_budget',
  description: 'Muda o orçamento diário de um Conjunto de Anúncios na Meta. Exige aprovação humana; a mudança percentual é checada contra o limite configurado nas políticas da org.',
  riskLevel: 'HIGH',
  requiresApproval: true,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const adapter = getAdsAdapter('meta')
    const supabaseAdmin = createAdminClient()
    const { checkAdsPolicyForMutation } = await import('@/actions/ads-policies')
    const changePct = input.currentDailyBudgetCents > 0
      ? ((input.dailyBudgetCents - input.currentDailyBudgetCents) / input.currentDailyBudgetCents) * 100
      : 100
    const policy = await checkAdsPolicyForMutation(supabaseAdmin, ctx.orgId, 'budget_change', changePct)
    if (!policy.allowed) throw new Error(policy.reason)
    if (!adapter.capabilities.updateBudget || !adapter.updateAdSetBudget) {
      throw new Error('Escrita na Meta não habilitada (requer permissão ads_management + App Review + META_ADS_WRITE_ENABLED=true)')
    }
    const token = await resolveAdsToken(supabaseAdmin, ctx.orgId, 'meta')
    if (!token) throw new Error('Token da conta de anúncio ausente ou expirado')
    const result = await adapter.updateAdSetBudget(input.adSetExternalId, input.dailyBudgetCents, token)
    if (!result.ok) throw new Error(result.error)
    return result
  },
}

export const listMediaPlanTool: ToolDef<{ client: string }> = {
  name: 'list_media_plan',
  description: 'Plano de mídia atual (estratégia/intenção) de um cliente — estrutura Campanha→Conjunto→Anúncio planejada, para comparar com o que está de fato publicado.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const supabase = createAdminClient()
    const { data: plan } = await supabase
      .from('media_plans')
      .select('id, name, version, status, objective_primary, period_start, period_end, budget_total_cents, target_leads, target_cpl_cents, target_roas')
      .eq('organization_id', ctx.orgId)
      .eq('contato_id', resolved.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!plan) return { client: resolved.name, plan: null, items: [] }
    const { data: items } = await supabase
      .from('media_plan_items')
      .select('id, parent_id, level, platform, name, status, budget_cents, budget_type')
      .eq('media_plan_id', plan.id)
    return { client: resolved.name, plan, items: items || [] }
  },
}
