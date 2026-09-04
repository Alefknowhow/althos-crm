/**
 * Pure aggregation helpers for getMarketingOverview: turn the raw rows
 * fetched from Supabase into per-campaign rows/totals, the daily time
 * series, and the previous-period comparison. Split out of
 * actions/marketing-overview.ts — no I/O except buildPreviousCampaigns,
 * which needs one more query for the prior window.
 */

import { classifyObjective, type ObjectiveGroup } from '@/lib/marketing/objective'

type CampaignRow = {
  id: string
  name: string
  objective: string | null
  status: string
  utm_campaign: string | null
  color: string | null
  ad_account_id: string
  external_id: string | null
  ad_accounts: any
}

type MetricRow = {
  campaign_id: string
  date: string
  impressions: number | null
  clicks: number | null
  spend_cents: number | null
  meta_leads: number | null
  meta_messaging_started: number | null
  meta_link_clicks: number | null
  meta_landing_page_views: number | null
  meta_purchases: number | null
  meta_purchase_value_cents: number | null
}

/** Builds the per-campaign rows, org-wide totals, and per-objective
 *  aggregation from campaigns + their metrics + lead-attribution rows. */
export function buildCampaignRows(
  campaigns: CampaignRow[],
  metrics: MetricRow[],
  subs: { utm_campaign: string | null; contato_id: string | null }[],
  trackingLinksRows: { id: string; campaign_id: string | null }[],
  wonDeals: { utm: any; value_cents: number | null; meta_resolved_campaign_id: string | null; tracking_link_id: string | null }[],
) {
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

  return {
    metricsByCampaign, linkIdToCampaignId, utmToCampaignId, wonByCampaignId, leadsByUtm, matchedContatoIds,
  }
}

/** Finishes the per-campaign rows once leads-by-tracking-link have also
 *  been resolved (needs a query gated on linkIdToCampaignId.size, done by
 *  the caller), and computes totals + the per-objective aggregation. */
export function finishCampaignRows(
  campaigns: CampaignRow[],
  built: ReturnType<typeof buildCampaignRows>,
  leadsByTrackingCampaignId: Map<string, number>,
) {
  const { metricsByCampaign, wonByCampaignId, leadsByUtm } = built

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

  // 8) Sources by leads (distribuição por campanha) — usa o mesmo `leads`
  // já calculado em campaignRows (UTM de formulário + link de rastreamento),
  // pra bater exatamente com o total mostrado na tabela de campanhas logo
  // abaixo (antes essa rosca só contava a atribuição por UTM).
  const sourcesByLeads = campaignRows
    .filter(c => c.leads > 0)
    .map(c => ({ name: c.name, value: c.leads }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return { campaignRows, totals, byObjective, sourcesByLeads }
}

/** 7) Daily time series — aggregate por (dia, conta de anúncios), pra o
 *  filtro de conta poder recalcular o gráfico client-side sem refetch. */
export function buildTimeSeries(
  campaigns: CampaignRow[],
  metrics: MetricRow[],
  subsForTs: { utm_campaign: string | null; created_at: string }[],
) {
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

  return Array.from(tsMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/** 9) Métricas do período anterior de mesmo tamanho (ex.: período = últimos
 *  7 dias → compara com os 7 dias antes disso), quebradas por campanha —
 *  não um totão só — pra o cliente poder filtrar por conta/objetivo
 *  exatamente como faz com `campaigns` (senão a comparação mistura contas
 *  que nem estão selecionadas na tela, produzindo número que não bate com
 *  nada visível). Só spend/impressions/clicks — leads exigiria duplicar
 *  toda a atribuição por UTM/tracking-link pra uma segunda janela, fora de
 *  escopo por ora.
 *  "Máximo" não tem janela anterior de mesmo tamanho pra comparar (o
 *  período já busca tudo que existir) — pula o cálculo, o card de
 *  comparação simplesmente não aparece nesse caso. */
export async function buildPreviousCampaigns(
  supabase: any,
  orgId: string,
  campaignIds: string[],
  campaigns: CampaignRow[],
  start: string,
  period: string,
) {
  if (period === 'max') return []

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
    .eq('organization_id', orgId)
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
  return Array.from(prevByCampaign.entries()).map(([campaignId, v]) => ({
    campaign_id: campaignId,
    ad_account_id: campaignMetaById.get(campaignId)?.ad_account_id ?? null,
    objective_group: campaignMetaById.get(campaignId)?.objective_group ?? 'other',
    ...v,
  }))
}
