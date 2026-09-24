import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getMarketingOverview,
  listAdAccounts,
  type MarketingPeriod,
} from '@/actions/marketing'
import MarketingOverviewCrossChannel from '@/components/features/marketing/MarketingOverviewCrossChannel'
import MarketingTabsNav from '@/components/features/marketing/MarketingTabsNav'

export const dynamic = 'force-dynamic'

/**
 * Anúncios → Visão Geral (issue #24) — rota padrão do módulo, agora que
 * "Anúncios" deixou de ser sinônimo de "painel Meta" (esse continua intacto
 * em /marketing/meta-ads). Consolida TODAS as contas/plataformas da
 * organização — getMarketingOverview já agrega por `campaigns`/`ad_accounts`
 * sem filtro de provider, então não precisa de uma query própria.
 */
export default async function MarketingOverviewPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { period?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const period = (searchParams.period as MarketingPeriod) || '30d'

  const [overview, accounts] = await Promise.all([
    getMarketingOverview(params.orgSlug, period),
    listAdAccounts(params.orgSlug),
  ])

  return (
    <>
      <MarketingTabsNav orgSlug={params.orgSlug} />
      <MarketingOverviewCrossChannel
        orgSlug={params.orgSlug}
        period={period}
        overview={overview}
        accounts={accounts as any[]}
      />
    </>
  )
}
