import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getMarketingOverview,
  listAdAccounts,
  listCampaigns,
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

  const [overview, accounts, campaigns] = await Promise.all([
    getMarketingOverview(params.orgSlug, period),
    listAdAccounts(params.orgSlug),
    listCampaigns(params.orgSlug),
  ])

  return (
    <MarketingOverview
      orgSlug={params.orgSlug}
      period={period}
      overview={overview}
      accounts={accounts as any[]}
      campaigns={campaigns as any[]}
    />
  )
}
