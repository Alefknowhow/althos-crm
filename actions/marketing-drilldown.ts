'use server'

/**
 * Campaign drill-down: ad sets, individual ads, and per-ad conversion
 * rows, all fetched live from the Meta Graph API. Split out of
 * marketing.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { periodStart, periodEnd, type MarketingPeriod } from '@/lib/marketing/period'
import { type DrillDownError, type DrillDownRow } from './marketing-overview'
import { summarizeInsights, classifyMetaError } from '@/lib/marketing/drilldown-helpers'

/**
 * Busca os Conjuntos de Anúncios (CJ) de uma campanha, 100% ao vivo na Meta
 * — sem gravar nada no banco. Só é chamado quando o usuário expande a linha
 * da campanha na tabela (ação pontual, não em todo carregamento de tela).
 */
export async function getCampaignAdSets(orgSlug: string, campaignId: string, period: MarketingPeriod = '30d') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: 'unknown' as DrillDownError }
  const supabase = createClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('external_id')
    .eq('id', campaignId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!campaign?.external_id) return { ok: false as const, error: 'not_found' as DrillDownError }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.meta_ads_access_token) return { ok: false as const, error: 'token_expired' as DrillDownError }

  const { fetchMetaAdSets, fetchMetaInsights } = await import('@/lib/meta/ads')
  const until = periodEnd(period)
  const since = periodStart(period)

  try {
    const adSets = await fetchMetaAdSets(campaign.external_id, orgRow.meta_ads_access_token)
    const rows: DrillDownRow[] = []
    for (const as of adSets) {
      let insights: Awaited<ReturnType<typeof fetchMetaInsights>> = []
      try {
        insights = await fetchMetaInsights(as.id, orgRow.meta_ads_access_token, since, until)
      } catch {
        // Sem métricas nesse período pra esse CJ — segue com zeros em vez de derrubar a linha toda.
      }
      rows.push({ id: as.id, name: as.name, status: (as.effective_status || as.status || '').toLowerCase(), ...summarizeInsights(insights) })
    }
    return { ok: true as const, rows }
  } catch (e: any) {
    return { ok: false as const, error: classifyMetaError(e) }
  }
}

/**
 * Busca os Anúncios de um Conjunto de Anúncios, mesmo padrão de
 * getCampaignAdSets (ao vivo, sem gravar no banco).
 */
export async function getAdSetAds(orgSlug: string, adSetExternalId: string, period: MarketingPeriod = '30d') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: 'unknown' as DrillDownError }
  const supabase = createClient()

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.meta_ads_access_token) return { ok: false as const, error: 'token_expired' as DrillDownError }

  const { fetchMetaAds, fetchMetaInsights } = await import('@/lib/meta/ads')
  const until = periodEnd(period)
  const since = periodStart(period)

  try {
    const ads = await fetchMetaAds(adSetExternalId, orgRow.meta_ads_access_token)
    const rows: DrillDownRow[] = []
    for (const ad of ads) {
      let insights: Awaited<ReturnType<typeof fetchMetaInsights>> = []
      try {
        insights = await fetchMetaInsights(ad.id, orgRow.meta_ads_access_token, since, until)
      } catch {
        // Sem métricas nesse período pra esse anúncio — segue com zeros.
      }
      rows.push({ id: ad.id, name: ad.name, status: (ad.effective_status || ad.status || '').toLowerCase(), ...summarizeInsights(insights) })
    }
    return { ok: true as const, rows }
  } catch (e: any) {
    return { ok: false as const, error: classifyMetaError(e) }
  }
}

export type AdConversionRow = {
  id: string
  name: string
  campaign_name: string
  meta_leads: number
  meta_messaging_started: number
  meta_purchases: number
  meta_purchase_value_cents: number
  impressions: number
  clicks: number
  spend_cents: number
}

/**
 * Métricas por anúncio individual (não por campanha) pro card "Conversão
 * por anúncio" do painel — uma chamada por conta de anúncios (nível de
 * conta, `level=ad`), sem precisar percorrer campanha → CJ → anúncio.
 * `adAccountId` null = todas as contas conectadas da org.
 */
export async function getAdConversionRows(
  orgSlug: string,
  adAccountId: string | null,
  period: MarketingPeriod = '30d',
): Promise<{ ok: true; rows: AdConversionRow[] } | { ok: false; error: DrillDownError }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: 'unknown' as DrillDownError }
  const supabase = createClient()

  let accountQuery = supabase
    .from('ad_accounts')
    .select('id, external_id')
    .eq('organization_id', org.id)
    .eq('provider', 'meta')
    .not('external_id', 'is', null)
  if (adAccountId) accountQuery = accountQuery.eq('id', adAccountId)
  const { data: accounts } = await accountQuery
  if (!accounts || accounts.length === 0) return { ok: true as const, rows: [] }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.meta_ads_access_token) return { ok: false as const, error: 'token_expired' as DrillDownError }

  const { fetchMetaAdAccountAdInsights } = await import('@/lib/meta/ads')
  const until = periodEnd(period)
  const since = periodStart(period)

  try {
    const rows: AdConversionRow[] = []
    for (const acc of accounts) {
      if (!acc.external_id) continue
      const insights = await fetchMetaAdAccountAdInsights(acc.external_id, orgRow.meta_ads_access_token, since, until)
      for (const i of insights) {
        rows.push({
          id: i.ad_id,
          name: i.ad_name,
          campaign_name: i.campaign_name,
          meta_leads: i.meta_leads,
          meta_messaging_started: i.meta_messaging_started,
          meta_purchases: i.meta_purchases,
          meta_purchase_value_cents: i.meta_purchase_value_cents,
          impressions: i.impressions,
          clicks: i.clicks,
          spend_cents: i.spend_cents,
        })
      }
    }
    return { ok: true as const, rows }
  } catch (e: any) {
    return { ok: false as const, error: classifyMetaError(e) }
  }
}
