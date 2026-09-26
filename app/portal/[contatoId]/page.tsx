import { redirect } from 'next/navigation'
import { requirePortalAccess, getPortalOverview, getPortalDailySeries, getPortalAdPlatforms, listPortalReports } from '@/actions/client-portal'
import { listPortalAdAccounts, listPortalCampaigns, listPortalConversions } from '@/actions/client-portal-data'
import { listPortalLibraryAssetChains } from '@/actions/client-portal-library'
import PortalDashboard from '@/components/features/portal/PortalDashboard'

export const dynamic = 'force-dynamic'

/** Portal do Cliente — Visão Geral/Contas/Biblioteca/Conversões/Relatórios,
 *  tudo escopado ao contatoId da URL e validado contra a membership real
 *  do usuário logado (requirePortalAccess), nunca confiando no valor da
 *  URL sozinho. Aprovação de criativos migrou pra dentro da Biblioteca
 *  (campaign_creatives não é mais exposto aqui). */
export default async function PortalClientPage({ params }: { params: { contatoId: string } }) {
  let access
  try {
    access = await requirePortalAccess(params.contatoId)
  } catch {
    redirect('/portal/login')
  }

  const [overview, dailySeries, availablePlatforms, reports, libraryChains, adAccounts, campaigns, conversions] = await Promise.all([
    getPortalOverview(params.contatoId),
    getPortalDailySeries(params.contatoId),
    getPortalAdPlatforms(params.contatoId),
    listPortalReports(params.contatoId),
    listPortalLibraryAssetChains(params.contatoId),
    listPortalAdAccounts(params.contatoId),
    listPortalCampaigns(params.contatoId),
    listPortalConversions(params.contatoId),
  ])

  return (
    <PortalDashboard
      contatoId={params.contatoId}
      clientName={access.contatoName}
      orgName={access.organizationName}
      overview={overview}
      dailySeries={dailySeries}
      availablePlatforms={availablePlatforms}
      reports={reports}
      libraryChains={libraryChains}
      adAccounts={adAccounts}
      campaigns={campaigns}
      conversions={conversions}
    />
  )
}
