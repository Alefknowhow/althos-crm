import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getMarketingOverview,
  listAdAccounts,
  listCampaigns,
  getMarketingMetricsPrefs,
  type MarketingPeriod,
} from '@/actions/marketing'
import { filterOverviewByProvider } from '@/lib/marketing/filter-overview'
import MarketingOverview from '@/components/features/marketing/MarketingOverview'
import MarketingTabsNav from '@/components/features/marketing/MarketingTabsNav'

export const dynamic = 'force-dynamic'

/**
 * Anúncios → Google Ads (issue #24) — ainda sem integração via API (exige
 * credenciais/aprovação do Google que o Althos não tem hoje), mas o modelo
 * de dados já suporta contas Google cadastradas manualmente + métricas
 * lançadas à mão ou importadas por CSV (ver NewAdAccountDialog/CsvImporter,
 * ambos já provider-aware). Reaproveita o mesmo painel do Meta Ads — o
 * componente é agnóstico de provider — só sem o badge de login OAuth
 * (que não existe pra este provider ainda).
 */
export default async function MarketingGoogleAdsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { period?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const period = (searchParams.period as MarketingPeriod) || '30d'

  const [overview, allAccounts, allCampaigns, metricsPrefs] = await Promise.all([
    getMarketingOverview(params.orgSlug, period),
    listAdAccounts(params.orgSlug),
    listCampaigns(params.orgSlug),
    getMarketingMetricsPrefs(params.orgSlug),
  ])

  const accounts = (allAccounts as any[]).filter(a => a.provider === 'google')
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
        initialMetricsPrefs={metricsPrefs}
      />
    </>
  )
}
