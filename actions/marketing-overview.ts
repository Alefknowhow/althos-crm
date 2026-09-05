'use server'

/**
 * Marketing dashboard aggregation (getMarketingOverview) and the
 * per-user metric display preferences. Split out of marketing.ts.
 *
 * Pure aggregation logic (per-campaign rows, time series, previous-period
 * comparison) lives in marketing-overview-aggregate.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { buildCampaignRows, finishCampaignRows, buildTimeSeries, buildPreviousCampaigns } from './marketing-overview-aggregate'
import { periodStart, type MarketingPeriod } from '@/lib/marketing/period'

export type { MarketingPeriod }

/* -------- Marketing dashboard aggregation -------- */

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

  const { data: trackingLinksRows } = await supabase
    .from('tracking_links')
    .select('id, campaign_id')
    .eq('organization_id', org.id)
    .not('campaign_id', 'is', null)

  const { data: wonDeals } = await supabase
    .from('contatos')
    .select('utm, value_cents, meta_resolved_campaign_id, tracking_link_id')
    .eq('organization_id', org.id)
    .eq('deal_status', 'ganho')
    .gte('updated_at', startIso)

  const built = buildCampaignRows(campaigns || [], metrics || [], subs || [], trackingLinksRows || [], wonDeals || [])

  // 4b) Leads atribuídos por link de rastreamento (FK direta) — só soma os
  // que ainda não foram contados via utm_campaign acima, pra não contar o
  // mesmo lead duas vezes quando o destino do link também carrega UTM na URL.
  const leadsByTrackingCampaignId = new Map<string, number>()
  if (built.linkIdToCampaignId.size > 0) {
    const { data: trackingLeads } = await supabase
      .from('contatos')
      .select('id, tracking_link_id')
      .eq('organization_id', org.id)
      .not('tracking_link_id', 'is', null)
      .gte('created_at', startIso)
    for (const lead of trackingLeads || []) {
      if (built.matchedContatoIds.has(lead.id)) continue
      const campaignId = lead.tracking_link_id ? built.linkIdToCampaignId.get(lead.tracking_link_id) : null
      if (!campaignId) continue
      leadsByTrackingCampaignId.set(campaignId, (leadsByTrackingCampaignId.get(campaignId) || 0) + 1)
    }
  }

  const { campaignRows, totals, byObjective, sourcesByLeads } = finishCampaignRows(campaigns || [], built, leadsByTrackingCampaignId)

  // Leads per day: re-fetch with created_at so we can bucket by date.
  const { data: subsForTs } = await supabase
    .from('form_submissions')
    .select('utm_campaign, created_at')
    .gte('created_at', startIso)
    .not('utm_campaign', 'is', null)

  const timeSeries = buildTimeSeries(campaigns || [], metrics || [], subsForTs || [])

  const previousCampaigns = await buildPreviousCampaigns(supabase, org.id, campaignIds, campaigns || [], start, period)

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
