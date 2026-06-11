import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listScheduledTrips } from '@/actions/travel-schedule'
import ScheduleClient from '@/components/features/schedule/ScheduleClient'

export const dynamic = 'force-dynamic'

export default async function ViagensProgramadasPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  // Niche-gated feature.
  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  const trips = await listScheduledTrips(params.orgSlug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Embarques</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe visualmente as viagens vendidas — datas de partida e retorno, tarefas relacionadas e atalho direto para o WhatsApp do cliente.
        </p>
      </div>

      <ScheduleClient orgSlug={params.orgSlug} trips={trips} />
    </div>
  )
}
