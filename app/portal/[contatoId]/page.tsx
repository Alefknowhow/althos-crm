import { redirect } from 'next/navigation'
import { requirePortalAccess, getPortalOverview, listPortalReports, listPortalCreatives, listPortalLibraryAssets } from '@/actions/client-portal'
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

  const [overview, reports, creatives, libraryAssets] = await Promise.all([
    getPortalOverview(params.contatoId),
    listPortalReports(params.contatoId),
    listPortalCreatives(params.contatoId),
    listPortalLibraryAssets(params.contatoId),
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
    />
  )
}
