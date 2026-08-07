/**
 * Meta Marketing API (read-only) — puxa campanhas e métricas diárias de uma
 * conta de anúncios pra alimentar campaigns/campaign_metrics_daily.
 *
 * Usa o mesmo System User token já salvo em organizations.meta_access_token
 * (o mesmo configurado pro CAPI/Pixel) — ele já tem escopo ads_management,
 * que cobre leitura (ads_read). Sem token novo, sem tela nova de config.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/insights
 */

const GRAPH_VERSION = 'v21.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

export type MetaCampaign = {
  id: string
  name: string
  objective: string | null
  status: string
  start_time: string | null
  stop_time: string | null
}

export type MetaDailyInsight = {
  campaign_id: string
  date: string // YYYY-MM-DD
  impressions: number
  clicks: number
  spend_cents: number
  meta_leads: number
  meta_messaging_started: number
  meta_link_clicks: number
  meta_landing_page_views: number
  meta_purchases: number
  meta_purchase_value_cents: number
}

type MetaAction = { action_type: string; value: string }

const LEAD_ACTION_TYPES = new Set(['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'])
const MESSAGING_ACTION_TYPES = new Set(['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply'])
const PURCHASE_ACTION_TYPES = new Set(['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase'])

/**
 * `actions`/`action_values` vêm como array de {action_type, value} com uma
 * taxonomia grande e ruidosa da Meta — filtra só os tipos relevantes pro
 * painel (leads, conversas de WhatsApp iniciadas, cliques, compras).
 */
function parseMetaActions(actions: MetaAction[] | undefined, actionValues: MetaAction[] | undefined) {
  let leads = 0, messagingStarted = 0, linkClicks = 0, landingPageViews = 0, purchases = 0

  for (const a of actions || []) {
    const value = Math.round(Number(a.value || 0))
    if (LEAD_ACTION_TYPES.has(a.action_type)) leads += value
    else if (MESSAGING_ACTION_TYPES.has(a.action_type)) messagingStarted += value
    else if (a.action_type === 'link_click') linkClicks += value
    else if (a.action_type === 'landing_page_view') landingPageViews += value
    else if (PURCHASE_ACTION_TYPES.has(a.action_type)) purchases += value
  }

  let purchaseValueCents = 0
  for (const av of actionValues || []) {
    if (PURCHASE_ACTION_TYPES.has(av.action_type)) purchaseValueCents += Math.round(Number(av.value || 0) * 100)
  }

  return {
    meta_leads: leads,
    meta_messaging_started: messagingStarted,
    meta_link_clicks: linkClicks,
    meta_landing_page_views: landingPageViews,
    meta_purchases: purchases,
    meta_purchase_value_cents: purchaseValueCents,
  }
}

async function metaGet(path: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(`${GRAPH}${path}?${qs.toString()}`, { cache: 'no-store' })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || `Falha na API da Meta (${res.status})`)
  return json
}

/**
 * Resolve o ad_id (source_id do `referral` de uma conversa de WhatsApp
 * iniciada por anúncio) pro campaign_id externo dono desse anúncio — usado
 * pra fechar a atribuição de CAC/ROAS de campanhas de WhatsApp. Retorna
 * null em qualquer falha (anúncio deletado, token sem permissão, etc.) —
 * não deve travar o webhook.
 */
export async function resolveAdCampaignExternalId(adId: string, token: string): Promise<string | null> {
  try {
    const json = await metaGet(`/${adId}`, { fields: 'campaign_id' }, token)
    return json?.campaign_id || null
  } catch {
    return null
  }
}

/** Lista campanhas de uma conta de anúncios (act_{id}). */
export async function fetchMetaCampaigns(adAccountExternalId: string, token: string): Promise<MetaCampaign[]> {
  const accountId = adAccountExternalId.startsWith('act_') ? adAccountExternalId : `act_${adAccountExternalId}`
  const json = await metaGet(`/${accountId}/campaigns`, {
    fields: 'id,name,objective,status,start_time,stop_time',
    limit: '200',
  }, token)
  return (json.data || []) as MetaCampaign[]
}

/**
 * Métricas diárias (spend/impressions/clicks) de uma campanha, num intervalo
 * de datas. `time_increment=1` faz a Meta já devolver quebrado por dia.
 */
export async function fetchMetaCampaignDailyInsights(
  campaignExternalId: string,
  token: string,
  since: string,
  until: string,
): Promise<MetaDailyInsight[]> {
  const json = await metaGet(`/${campaignExternalId}/insights`, {
    fields: 'impressions,clicks,spend,date_start,actions,action_values',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '500',
  }, token)
  return ((json.data || []) as any[]).map(row => ({
    campaign_id: campaignExternalId,
    date: row.date_start,
    impressions: Math.round(Number(row.impressions || 0)),
    clicks: Math.round(Number(row.clicks || 0)),
    spend_cents: Math.round(Number(row.spend || 0) * 100),
    ...parseMetaActions(row.actions, row.action_values),
  }))
}
