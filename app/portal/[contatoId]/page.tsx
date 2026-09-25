import { redirect } from 'next/navigation'
import { requirePortalAccess, getPortalOverview, listPortalReports } from '@/actions/client-portal'
import {
  listPortalCreatives, listPortalLibraryAssets, listPortalAdAccounts, listPortalCampaigns, listPortalConversions,
} from '@/actions/client-portal-data'
import PortalDashboard from '@/components/features/portal/PortalDashboard'

export const dynamic = 'force-dynamic'

/** Portal do Cliente — Visão Geral/Relatórios/Criativos, tudo escopado ao
 *  contatoId da URL e validado contra a membership real do usuário
 *  logado (requirePortalAccess), nunca confiando no valor da URL sozinho. */
export default async function PortalClientPage({ params }: { params: { contatoId: string } }) {
  let access
  try {
    access = await requirePortalAccess(params.contatoId)
  } catch {
    redirect('/portal/login')
  }

  const [overview, reports, creatives, libraryAssets, adAccounts, campaigns, conversions] = await Promise.all([
    getPortalOverview(params.contatoId),
    listPortalReports(params.contatoId),
    listPortalCreatives(params.contatoId),
    listPortalLibraryAssets(params.contatoId),
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
      reports={reports}
      creatives={creatives}
      libraryAssets={libraryAssets}
      adAccounts={adAccounts}
      campaigns={campaigns}
      conversions={conversions}
    />
  )
}
