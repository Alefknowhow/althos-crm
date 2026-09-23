import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listScheduledTrips } from '@/actions/travel-schedule'
import { listOrgMembers } from '@/actions/team'
import ScheduleTimelineClient from '@/components/features/schedule/ScheduleTimelineClient'
import { PageHeader } from '@/components/ui/page-header'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function ViagensLinhaDoTempoPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  // Niche-gated feature — mesmo módulo da Lista (Embarques).
  await requireModuleEnabled(org.niche, 'embarques')

  const [trips, members] = await Promise.all([
    listScheduledTrips(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])

  return (
    <div className="pt-3 -mb-5 space-y-4">
      <PageHeader
        title="Linha do tempo"
        hint="Visão de calendário das viagens vendidas — mesmos dados e filtros da Lista, em barras por período de embarque a retorno."
      />

      <ScheduleTimelineClient orgSlug={params.orgSlug} trips={trips} members={members} />
    </div>
  )
}
