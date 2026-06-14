import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  listEventTypes,
  listAvailabilities,
  listAppointments,
} from '@/actions/appointments'
import { listPipelines } from '@/actions/pipeline'
import { createClient } from '@/lib/supabase/server'
import AppointmentsAdminTabs from '@/components/features/appointments/AppointmentsAdminTabs'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function AgendamentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const [eventTypes, availabilities, upcoming, past, pipelines, pipelinesForStages] = await Promise.all([
    listEventTypes(params.orgSlug),
    listAvailabilities(params.orgSlug),
    listAppointments(params.orgSlug, 'upcoming'),
    listAppointments(params.orgSlug, 'past'),
    listPipelines(params.orgSlug),
    supabase.from('pipelines').select('id').eq('organization_id', org.id),
  ])

  const pipelineIds = (pipelinesForStages.data || []).map(p => p.id)
  const { data: stages } =
    pipelineIds.length > 0
      ? await supabase
          .from('pipeline_stages')
          .select('id, name, pipeline_id')
          .in('pipeline_id', pipelineIds)
          .order('position')
      : { data: [] }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendamentos"
        hint="Crie tipos de evento, defina horários disponíveis e gerencie agendamentos."
      />

      <AppointmentsAdminTabs
        orgSlug={params.orgSlug}
        eventTypes={eventTypes as any[]}
        availabilities={availabilities}
        upcoming={upcoming as any[]}
        past={past as any[]}
        pipelines={pipelines}
        stages={stages || []}
      />
    </div>
  )
}
