import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getMarketingOverview,
  listAdAccounts,
  listCampaigns,
  getMetaAdsLoginStatus,
  getMarketingMetricsPrefs,
  type MarketingPeriod,
} from '@/actions/marketing'
import { filterOverviewByProvider } from '@/lib/marketing/filter-overview'
import MarketingOverview from '@/components/features/marketing/MarketingOverview'
import MarketingTabsNav from '@/components/features/marketing/MarketingTabsNav'

export const dynamic = 'force-dynamic'

/**
 * Anúncios → Meta Ads (issue #24) — o painel Meta que antes vivia direto em
 * /marketing, preservado sem perda de funcionalidade (conexão OAuth,
 * resync, drill-down). Só ganhou o recorte por provider: contas/campanhas/
 * overview restritos a `provider = 'meta'`, pra não misturar com contas
 * Google/TikTok cadastradas manualmente na mesma organização.
 */
export default async function MarketingMetaAdsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { period?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const period = (searchParams.period as MarketingPeriod) || '30d'

  const [overview, allAccounts, allCampaigns, loginStatus, metricsPrefs] = await Promise.all([
    getMarketingOverview(params.orgSlug, period),
    listAdAccounts(params.orgSlug),
    listCampaigns(params.orgSlug),
    getMetaAdsLoginStatus(params.orgSlug),
    getMarketingMetricsPrefs(params.orgSlug),
  ])

  const accounts = (allAccounts as any[]).filter(a => a.provider === 'meta')
  const accountIds = new Set(accounts.map(a => a.id))
  const campaigns = (allCampaigns as any[]).filter(c => accountIds.has(c.ad_account_id))

  return (
    <>
      <MarketingTabsNav orgSlug={params.orgSlug} />
      <MarketingOverview
        orgSlug={params.orgSlug}
        period={period}
        overview={filterOverviewByProvider(overview, accountIds)}
        accounts={accounts}
        campaigns={campaigns}
        metaLoginUserName={loginStatus.userName}
        initialMetricsPrefs={metricsPrefs}
      />
    </>
  )
}
