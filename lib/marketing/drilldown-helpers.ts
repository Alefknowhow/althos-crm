/**
 * Helpers puros compartilhados pelo drill-down Meta (painel interno em
 * actions/marketing-drilldown.ts e Portal em actions/client-portal-data.ts)
 * — extraídos pra um arquivo sem 'use server', porque um arquivo de Server
 * Actions só pode exportar funções async (`summarizeInsights`/
 * `classifyMetaError` são síncronas e quebravam o build de produção,
 * mesmo passando limpo no `tsc --noEmit`).
 */

import type { DrillDownError } from '@/actions/marketing-overview'

export function summarizeInsights(rows: Array<{ impressions: number; clicks: number; spend_cents: number; meta_leads: number; meta_messaging_started: number; meta_link_clicks: number; meta_purchases: number; meta_purchase_value_cents: number }>) {
  const agg = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend_cents
      acc.imp += r.impressions
      acc.clicks += r.clicks
      acc.metaLeads += r.meta_leads
      acc.messagingStarted += r.meta_messaging_started
      acc.linkClicks += r.meta_link_clicks
      acc.purchases += r.meta_purchases
      acc.purchaseValueCents += r.meta_purchase_value_cents
      return acc
    },
    { spend: 0, imp: 0, clicks: 0, metaLeads: 0, messagingStarted: 0, linkClicks: 0, purchases: 0, purchaseValueCents: 0 },
  )
  return {
    spend_cents: agg.spend,
    impressions: agg.imp,
    clicks: agg.clicks,
    ctr: agg.imp > 0 ? (agg.clicks / agg.imp) * 100 : 0,
    meta_leads: agg.metaLeads,
    meta_messaging_started: agg.messagingStarted,
    meta_link_clicks: agg.linkClicks,
    meta_purchases: agg.purchases,
    meta_purchase_value_cents: agg.purchaseValueCents,
    cost_per_conversation_cents: agg.messagingStarted > 0 ? Math.round(agg.spend / agg.messagingStarted) : null,
    meta_cpl_cents: agg.metaLeads > 0 ? Math.round(agg.spend / agg.metaLeads) : null,
  }
}

export function classifyMetaError(e: any): DrillDownError {
  const msg = String(e?.message || '').toLowerCase()
  if (msg.includes('190') || msg.includes('expired') || msg.includes('token')) return 'token_expired'
  if (msg.includes('rate limit') || msg.includes('too many calls') || msg.includes('613')) return 'rate_limited'
  if (msg.includes('does not exist') || msg.includes('cannot be loaded') || msg.includes('100')) return 'not_found'
  return 'unknown'
}
