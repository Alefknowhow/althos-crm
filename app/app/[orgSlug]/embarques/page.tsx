import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listScheduledTrips } from '@/actions/travel-schedule'
import { listOrgMembers } from '@/actions/team'
import ScheduleClient from '@/components/features/schedule/ScheduleClient'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function ViagensProgramadasPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  // Niche-gated feature.
  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  const [trips, members] = await Promise.all([
    listScheduledTrips(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])

  return (
    <div className="pt-3 space-y-6">
      <PageHeader
        title="Embarques"
        hint="Acompanhe visualmente as viagens vendidas — datas de partida e retorno, tarefas relacionadas e atalho direto para o WhatsApp do cliente."
      />

      <ScheduleClient orgSlug={params.orgSlug} trips={trips} members={members} />
    </div>
  )
}
