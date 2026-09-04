'use server'

/**
 * Marketing dashboard aggregation (getMarketingOverview) and the
 * per-user metric display preferences. Split out of marketing.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { classifyObjective, type ObjectiveGroup } from '@/lib/marketing/objective'

/* -------- Marketing dashboard aggregation -------- */

export type MarketingPeriod = '7d' | '30d' | '90d' | 'mtd' | 'max'

// Data-teto pra "Máximo" — bem antes de qualquer conta de anúncio real, só
// pra servir de `since` sem período final (busca tudo que existir).
const MAX_PERIOD_START = '2015-01-01'

export function periodStart(period: MarketingPeriod): string {
  const now = new Date()
  if (period === 'max') return MAX_PERIOD_START
  if (period === 'mtd') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * One-shot aggregation for the Marketing page: totals for the period,
 * per-campaign breakdown (with attributed leads), and the daily time series
 * for the chart. Returns null if no data — caller renders an empty state.
 */
export async function getMarketingOverview(orgSlug: string, period: MarketingPeriod = '30d') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) {
    return { totals: { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, won_deals: 0, revenue_cents: 0 }, campaigns: [], timeSeries: [], sourcesByLeads: [], byObjective: [], previousCampaigns: [] }
  }
  const supabase = createClient()
  const start = periodStart(period)

  // 1) Pull campaigns + their metrics in the window.
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(
      'id, name, objective, status, utm_campaign, color, ad_account_id, external_id, ad_accounts(name, provider)',
    )
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const campaignIds = (campaigns || []).map(c => c.id)
  if (campaignIds.length === 0) {
    return {
      totals: { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, won_deals: 0, revenue_cents: 0 },
      campaigns: [],
      timeSeries: [],
      sourcesByLeads: [],
      byObjective: [],
      previousCampaigns: [],
    }
  }

  const { data: metrics } = await supabase
    .from('campaign_metrics_daily')
    .select('campaign_id, date, impressions, clicks, spend_cents, meta_leads, meta_messaging_started, meta_link_clicks, meta_landing_page_views, meta_purchases, meta_purchase_value_cents')
    .in('campaign_id', campaignIds)
    .eq('organization_id', org.id)
    .gte('date', start)

  // 2) Pull leads from this org since `start` to compute attribution.
  // Match by leads.source LIKE '%form:<...>%' OR by joining with form_submissions.utm_campaign.
  // For simplicity: query form_submissions in the window, group by utm_campaign.
  const startIso = new Date(start).toISOString()
  const { data: orgForms } = await supabase.from('forms').select('id').eq('organization_id', org.id)
  const orgFormIds = (orgForms || []).map(f => f.id)
  const { data: subs } = orgFormIds.length
    ? await supabase
        .from('form_submissions')
        .select('utm_campaign, contato_id')
        .in('form_id', orgFormIds)
        .gte('created_at', startIso)
        .not('utm_campaign', 'is', null)
    : { data: [] as { utm_campaign: string | null; contato_id: string | null }[] }

  // 3) Aggregate metrics per campaign.
  const metricsByCampaign = new Map<
    string,
    { spend: number; imp: number; clicks: number; metaLeads: number; messagingStarted: number; linkClicks: number; landingPageViews: number; purchases: number; purchaseValueCents: number }
  >()
  for (const m of metrics || []) {
    const cur = metricsByCampaign.get(m.campaign_id) || {
      spend: 0, imp: 0, clicks: 0, metaLeads: 0, messagingStarted: 0, linkClicks: 0, landingPageViews: 0, purchases: 0, purchaseValueCents: 0,
    }
    cur.spend += m.spend_cents || 0
    cur.imp += m.impressions || 0
    cur.clicks += m.clicks || 0
    cur.metaLeads += m.meta_leads || 0
    cur.messagingStarted += m.meta_messaging_started || 0
    cur.linkClicks += m.meta_link_clicks || 0
    cur.landingPageViews += m.meta_landing_page_views || 0
    cur.purchases += m.meta_purchases || 0
    cur.purchaseValueCents += m.meta_purchase_value_cents || 0
    metricsByCampaign.set(m.campaign_id, cur)
  }

  // 2b) Links de rastreamento próprios (Fase 1 do sistema de tracking) —
  // quando um lead chega por um /r/{code} nosso, contatos.tracking_link_id
  // aponta direto pro link, que por sua vez pode ter campaign_id vinculado.
  // Isso é atribuição por FK de verdade, prioridade sobre o match por texto
  // (utm_campaign) abaixo — só cai no texto pra tráfego que não passou por
  // um link nosso (ex.: campanhas antigas, ou o gestor colou o link direto
  // do anúncio sem usar /r/{code}).
  const { data: trackingLinksRows } = await supabase
    .from('tracking_links')
    .select('id, campaign_id')
    .eq('organization_id', org.id)
    .not('campaign_id', 'is', null)
  const linkIdToCampaignId = new Map<string, string>()
  for (const l of trackingLinksRows || []) {
    if (l.campaign_id) linkIdToCampaignId.set(l.id, l.campaign_id)
  }

  // 3b) Negócios ganhos no período, atribuídos a uma campanha — alimenta
  // CAC/ROAS. Prioridade: (a) tracking_link_id (FK direta, ver acima); (b)
  // meta_resolved_campaign_id, gravado no webhook do WhatsApp quando a
  // conversa vem de um anúncio de Click-to-WhatsApp (ad_id → campaign_id já
  // resolvido, ver resolveAdCampaignExternalId em lib/meta/ads.ts) — direto,
  // sem match de texto; (c) utm_campaign do lead (formulários/tráfego),
  // mesmo padrão de form_submissions.utm_campaign abaixo.
  const { data: wonDeals } = await supabase
    .from('contatos')
    .select('utm, value_cents, meta_resolved_campaign_id, tracking_link_id')
    .eq('organization_id', org.id)
    .eq('deal_status', 'ganho')
    .gte('updated_at', startIso)

  const utmToCampaignId = new Map<string, string>()
  for (const c of campaigns || []) {
    const key = (c.utm_campaign || '').trim().toLowerCase()
    if (key) utmToCampaignId.set(key, c.id)
  }

  const wonByCampaignId = new Map<string, { count: number; revenue_cents: number }>()
  for (const d of wonDeals || []) {
    const campaignId = (d.tracking_link_id && linkIdToCampaignId.get(d.tracking_link_id))
      || d.meta_resolved_campaign_id
      || utmToCampaignId.get(String((d.utm as any)?.utm_campaign || '').trim().toLowerCase())
    if (!campaignId) continue
    const cur = wonByCampaignId.get(campaignId) || { count: 0, revenue_cents: 0 }
    cur.count += 1
    cur.revenue_cents += d.value_cents || 0
    wonByCampaignId.set(campaignId, cur)
  }

  // 4) Map utm_campaign → number of leads.
  const leadsByUtm = new Map<string, number>()
  const matchedContatoIds = new Set<string>()
  for (const s of subs || []) {
    const key = String(s.utm_campaign || '').trim().toLowerCase()
    if (!key || !utmToCampaignId.has(key)) continue
    leadsByUtm.set(key, (leadsByUtm.get(key) || 0) + 1)
    if (s.contato_id) matchedContatoIds.add(s.contato_id)
  }

  // 4b) Leads atribuídos por link de rastreamento (FK direta) — só soma os
  // que ainda não foram contados via utm_campaign acima, pra não contar o
  // mesmo lead duas vezes quando o destino do link também carrega UTM na URL.
  const leadsByTrackingCampaignId = new Map<string, number>()
  if (linkIdToCampaignId.size > 0) {
    const { data: trackingLeads } = await supabase
      .from('contatos')
      .select('id, tracking_link_id')
      .eq('organization_id', org.id)
      .not('tracking_link_id', 'is', null)
      .gte('created_at', startIso)
    for (const lead of trackingLeads || []) {
      if (matchedContatoIds.has(lead.id)) continue
      const campaignId = lead.tracking_link_id ? linkIdToCampaignId.get(lead.tracking_link_id) : null
      if (!campaignId) continue
      leadsByTrackingCampaignId.set(campaignId, (leadsByTrackingCampaignId.get(campaignId) || 0) + 1)
    }
  }

  // 5) Build per-campaign rows.
  const campaignRows = (campaigns || []).map(c => {
    const m = metricsByCampaign.get(c.id) || {
      spend: 0, imp: 0, clicks: 0, metaLeads: 0, messagingStarted: 0, linkClicks: 0, landingPageViews: 0, purchases: 0, purchaseValueCents: 0,
    }
    const utm = (c.utm_campaign || '').trim().toLowerCase()
    const leads = (utm ? leadsByUtm.get(utm) || 0 : 0) + (leadsByTrackingCampaignId.get(c.id) || 0)
    const won = wonByCampaignId.get(c.id)
    const account = Array.isArray(c.ad_accounts) ? c.ad_accounts[0] : c.ad_accounts
    const objectiveGroup = classifyObjective(c.objective)

    // CAC/ROAS agora cobrem as 3 frentes: leads/tráfego/vendas via
    // utm_campaign, e WhatsApp via meta_resolved_campaign_id (ad_id do
    // referral CTWA resolvido no webhook — ver comentário acima). Só fica
    // nulo quando não há nenhum negócio ganho atribuído no período.
    const cac_cents = won && won.count > 0 ? Math.round(m.spend / won.count) : null
    const roas = won && m.spend > 0 ? won.revenue_cents / m.spend : null

    return {
      id: c.id,
      name: c.name,
      color: c.color,
      status: c.status,
      objective: c.objective,
      objective_group: objectiveGroup,
      ad_account_id: c.ad_account_id,
      external_id: c.external_id,
      provider: account?.provider || 'other',
      account_name: account?.name || '—',
      spend_cents: m.spend,
      impressions: m.imp,
      clicks: m.clicks,
      leads,
      cpl_cents: leads > 0 ? Math.round(m.spend / leads) : null,
      cpm_cents: m.imp > 0 ? Math.round((m.spend / m.imp) * 1000) : null,
      ctr: m.imp > 0 ? (m.clicks / m.imp) * 100 : 0,
      meta_leads: m.metaLeads,
      meta_messaging_started: m.messagingStarted,
      meta_link_clicks: m.linkClicks,
      meta_landing_page_views: m.landingPageViews,
      meta_purchases: m.purchases,
      meta_purchase_value_cents: m.purchaseValueCents,
      cost_per_conversation_cents: m.messagingStarted > 0 ? Math.round(m.spend / m.messagingStarted) : null,
      won_deals: won?.count || 0,
      revenue_cents: won?.revenue_cents || 0,
      cac_cents,
      roas,
    }
  })

  // 6) Totals.
  const totals = campaignRows.reduce(
    (acc, c) => {
      acc.spend_cents += c.spend_cents
      acc.impressions += c.impressions
      acc.clicks += c.clicks
      acc.leads += c.leads
      acc.won_deals += c.won_deals
      acc.revenue_cents += c.revenue_cents
      return acc
    },
    { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, won_deals: 0, revenue_cents: 0 },
  )

  // Agregado por objetivo — alimenta o filtro em abas no painel.
  const byObjective = Array.from(
    campaignRows.reduce((acc, c) => {
      const cur = acc.get(c.objective_group) || {
        group: c.objective_group, spend_cents: 0, leads: 0, meta_messaging_started: 0, won_deals: 0, revenue_cents: 0,
      }
      cur.spend_cents += c.spend_cents
      cur.leads += c.leads
      cur.meta_messaging_started += c.meta_messaging_started
      cur.won_deals += c.won_deals
      cur.revenue_cents += c.revenue_cents
      acc.set(c.objective_group, cur)
      return acc
    }, new Map<ObjectiveGroup, { group: ObjectiveGroup; spend_cents: number; leads: number; meta_messaging_started: number; won_deals: number; revenue_cents: number }>()).values(),
  )

  // 7) Daily time series — aggregate por (dia, conta de anúncios), pra o
  // filtro de conta poder recalcular o gráfico client-side sem refetch.
  const campaignIdToAccountId = new Map<string, string>()
  for (const c of campaigns || []) campaignIdToAccountId.set(c.id, c.ad_account_id)

  const tsMap = new Map<
    string,
    { date: string; ad_account_id: string; campaign_id: string; spend_cents: number; impressions: number; clicks: number; leads: number; meta_leads: number; meta_messaging_started: number; meta_link_clicks: number; meta_landing_page_views: number; meta_purchases: number; meta_purchase_value_cents: number; won_deals: number; revenue_cents: number }
  >()
  for (const m of metrics || []) {
    const accountId = campaignIdToAccountId.get(m.campaign_id) || 'unknown'
    const key = `${m.date}|${m.campaign_id}`
    const cur =
      tsMap.get(key) ||
      { date: m.date, ad_account_id: accountId, campaign_id: m.campaign_id, spend_cents: 0, impressions: 0, clicks: 0, leads: 0, meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0, won_deals: 0, revenue_cents: 0 }
    cur.spend_cents += m.spend_cents || 0
    cur.impressions += m.impressions || 0
    cur.clicks += m.clicks || 0
    cur.meta_leads += m.meta_leads || 0
    cur.meta_messaging_started += m.meta_messaging_started || 0
    cur.meta_link_clicks += m.meta_link_clicks || 0
    cur.meta_landing_page_views += m.meta_landing_page_views || 0
    cur.meta_purchases += m.meta_purchases || 0
    cur.meta_purchase_value_cents += m.meta_purchase_value_cents || 0
    tsMap.set(key, cur)
  }

  // utm_campaign → ad_account_id/campaign_id, pra bucketar leads de
  // formulário na conta e campanha certas.
  const utmToAccountId = new Map<string, string>()
  const utmToCampaignIdForTs = new Map<string, string>()
  for (const c of campaigns || []) {
    const key = (c.utm_campaign || '').trim().toLowerCase()
    if (key) {
      utmToAccountId.set(key, c.ad_account_id)
      utmToCampaignIdForTs.set(key, c.id)
    }
  }

  // Leads per day: re-fetch with created_at so we can bucket by date.
  const { data: subsForTs } = await supabase
    .from('form_submissions')
    .select('utm_campaign, created_at')
    .gte('created_at', startIso)
    .not('utm_campaign', 'is', null)

  // Only count leads attributed to a known campaign — otherwise the donut and
  // the time series would disagree (donut filters; ts would not).
  const knownUtms = new Set(
    (campaigns || [])
      .map(c => (c.utm_campaign || '').trim().toLowerCase())
      .filter(Boolean),
  )

  for (const s of subsForTs || []) {
    const utm = String(s.utm_campaign || '').trim().toLowerCase()
    if (!knownUtms.has(utm)) continue
    const day = String(s.created_at).slice(0, 10)
    const accountId = utmToAccountId.get(utm) || 'unknown'
    const campaignId = utmToCampaignIdForTs.get(utm) || 'unknown'
    const key = `${day}|${campaignId}`
    const cur =
      tsMap.get(key) ||
      { date: day, ad_account_id: accountId, campaign_id: campaignId, spend_cents: 0, impressions: 0, clicks: 0, leads: 0, meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0, won_deals: 0, revenue_cents: 0 }
    cur.leads += 1
    tsMap.set(key, cur)
  }

  const timeSeries = Array.from(tsMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  // 8) Sources by leads (distribuição por campanha) — usa o mesmo `leads`
  // já calculado em campaignRows (UTM de formulário + link de rastreamento),
  // pra bater exatamente com o total mostrado na tabela de campanhas logo
  // abaixo (antes essa rosca só contava a atribuição por UTM).
  const sourcesByLeads = campaignRows
    .filter(c => c.leads > 0)
    .map(c => ({ name: c.name, value: c.leads }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  // 9) Métricas do período anterior de mesmo tamanho (ex.: período = últimos
  // 7 dias → compara com os 7 dias antes disso), quebradas por campanha —
  // não um totão só — pra o cliente poder filtrar por conta/objetivo
  // exatamente como faz com `campaigns` (senão a comparação mistura contas
  // que nem estão selecionadas na tela, produzindo número que não bate com
  // nada visível). Só spend/impressions/clicks — leads exigiria duplicar
  // toda a atribuição por UTM/tracking-link pra uma segunda janela, fora de
  // escopo por ora.
  // "Máximo" não tem janela anterior de mesmo tamanho pra comparar (o
  // período já busca tudo que existir) — pula o cálculo, o card de
  // comparação simplesmente não aparece nesse caso.
  let previousCampaigns: { campaign_id: string; ad_account_id: string | null; objective_group: ObjectiveGroup; spend_cents: number; impressions: number; clicks: number; meta_leads: number; meta_messaging_started: number; meta_purchases: number }[] = []
  if (period !== 'max') {
    const startDate = new Date(`${start}T00:00:00`)
    const lengthMs = Date.now() - startDate.getTime()
    const prevEndDate = new Date(startDate.getTime() - 86400000)
    const prevStartDate = new Date(prevEndDate.getTime() - lengthMs)
    const prevStart = prevStartDate.toISOString().slice(0, 10)
    const prevEnd = prevEndDate.toISOString().slice(0, 10)

    const { data: prevMetrics } = await supabase
      .from('campaign_metrics_daily')
      .select('campaign_id, spend_cents, impressions, clicks, meta_leads, meta_messaging_started, meta_purchases')
      .in('campaign_id', campaignIds)
      .eq('organization_id', org.id)
      .gte('date', prevStart)
      .lte('date', prevEnd)

    const campaignMetaById = new Map((campaigns || []).map(c => [c.id, { ad_account_id: c.ad_account_id, objective_group: classifyObjective(c.objective) }]))
    const prevByCampaign = new Map<string, { spend_cents: number; impressions: number; clicks: number; meta_leads: number; meta_messaging_started: number; meta_purchases: number }>()
    for (const m of prevMetrics || []) {
      const cur = prevByCampaign.get(m.campaign_id) || { spend_cents: 0, impressions: 0, clicks: 0, meta_leads: 0, meta_messaging_started: 0, meta_purchases: 0 }
      cur.spend_cents += m.spend_cents || 0
      cur.impressions += m.impressions || 0
      cur.clicks += m.clicks || 0
      cur.meta_leads += m.meta_leads || 0
      cur.meta_messaging_started += m.meta_messaging_started || 0
      cur.meta_purchases += m.meta_purchases || 0
      prevByCampaign.set(m.campaign_id, cur)
    }
    previousCampaigns = Array.from(prevByCampaign.entries()).map(([campaignId, v]) => ({
      campaign_id: campaignId,
      ad_account_id: campaignMetaById.get(campaignId)?.ad_account_id ?? null,
      objective_group: campaignMetaById.get(campaignId)?.objective_group ?? 'other',
      ...v,
    }))
  }

  return { totals, campaigns: campaignRows, timeSeries, sourcesByLeads, byObjective, previousCampaigns }
}

/* -------- Preferências do painel (quais cards/métricas ficam visíveis) -------- */

export type MarketingMetricsPrefs = { cardMetrics: string[]; chartMetrics: string[] }

/** Preferências de exibição do painel salvas por org — sobrevivem entre
 *  sessões e valem pra todo mundo que abre Anúncios nessa organização. */
export async function getMarketingMetricsPrefs(orgSlug: string): Promise<MarketingMetricsPrefs | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('org_settings')
    .select('marketing_metrics_prefs')
    .eq('org_id', org.id)
    .maybeSingle()
  return (data?.marketing_metrics_prefs as MarketingMetricsPrefs | null) ?? null
}

export async function updateMarketingMetricsPrefs(orgSlug: string, prefs: MarketingMetricsPrefs) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('org_settings')
    .upsert({ org_id: org.id, marketing_metrics_prefs: prefs }, { onConflict: 'org_id' })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

/* -------- Drill-down: Conjuntos de Anúncios (CJ) e Anúncios, ao vivo -------- */

export type DrillDownError = 'token_expired' | 'not_found' | 'rate_limited' | 'unknown'

export type DrillDownRow = {
  id: string
  name: string
  status: string
  spend_cents: number
  impressions: number
  clicks: number
  ctr: number
  meta_leads: number
  meta_messaging_started: number
  meta_link_clicks: number
  meta_purchases: number
  meta_purchase_value_cents: number
  cost_per_conversation_cents: number | null
  meta_cpl_cents: number | null
}

