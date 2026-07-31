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
}

async function metaGet(path: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(`${GRAPH}${path}?${qs.toString()}`, { cache: 'no-store' })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || `Falha na API da Meta (${res.status})`)
  return json
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
    fields: 'impressions,clicks,spend,date_start',
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
  }))
}
