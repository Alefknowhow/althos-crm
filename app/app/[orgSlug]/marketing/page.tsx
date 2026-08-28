import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getMarketingOverview,
  listAdAccounts,
  listCampaigns,
  getMetaAdsLoginStatus,
  getMarketingMetricsPrefs,
  type MarketingPeriod,
} from '@/actions/marketing'
import MarketingOverview from '@/components/features/marketing/MarketingOverview'

export const dynamic = 'force-dynamic'

export default async function MarketingPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { period?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const period = (searchParams.period as MarketingPeriod) || '30d'

  const [overview, accounts, campaigns, loginStatus, metricsPrefs] = await Promise.all([
    getMarketingOverview(params.orgSlug, period),
    listAdAccounts(params.orgSlug),
    listCampaigns(params.orgSlug),
    getMetaAdsLoginStatus(params.orgSlug),
    getMarketingMetricsPrefs(params.orgSlug),
  ])

  return (
    <MarketingOverview
      orgSlug={params.orgSlug}
      period={period}
      overview={overview}
      accounts={accounts as any[]}
      campaigns={campaigns as any[]}
      metaLoginUserName={loginStatus.userName}
      initialMetricsPrefs={metricsPrefs}
    />
  )
}
