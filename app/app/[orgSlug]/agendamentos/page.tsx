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
import { isClinicNiche } from '@/lib/niche'
import {
  listClinicSpecialties, listClinicProfessionals, listClinicRooms, listClinicAppointmentContexts,
  getClinicReminderSettings, type ClinicReminderSettings,
} from '@/actions/clinic'
import { listClinicSupplies } from '@/actions/clinic-estoque'

export const dynamic = 'force-dynamic'

export default async function AgendamentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()
  const isClinic = isClinicNiche((org as any).niche)

  const [eventTypes, availabilities, upcoming, past, pipelines, pipelinesForStages] = await Promise.all([
    listEventTypes(params.orgSlug),
    listAvailabilities(params.orgSlug),
    listAppointments(params.orgSlug, 'upcoming'),
    listAppointments(params.orgSlug, 'past'),
    listPipelines(params.orgSlug),
    supabase.from('pipelines').select('id').eq('organization_id', org.id),
  ])

  // Contexto clínico — só busca quando o nicho é Clínicas, pra não pagar
  // essas queries extras em nenhum outro tenant.
  let clinicSpecialties: { id: string; name: string }[] = []
  let clinicProfessionals: { id: string; name: string; avatar_url?: string | null }[] = []
  let clinicRooms: { id: string; name: string }[] = []
  let clinicAppointmentContexts: Record<string, any> = {}
  let clinicServiceContexts: Record<string, any> = {}
  let reminderSettings: ClinicReminderSettings | null = null
  let clinicSupplies: { id: string; name: string }[] = []
  if (isClinic) {
    const allAppointmentIds = [...upcoming, ...past].map((a: any) => a.id)
    const [specialties, professionals, rooms, apptContexts, svcContextsRows, reminder, supplies] = await Promise.all([
      listClinicSpecialties(params.orgSlug),
      listClinicProfessionals(params.orgSlug),
      listClinicRooms(params.orgSlug),
      listClinicAppointmentContexts(params.orgSlug, allAppointmentIds),
      supabase.from('clinic_service_context').select('event_type_id, specialty_id, price_cents, room_id, default_discount_cents, professional_id').eq('organization_id', org.id),
      getClinicReminderSettings(params.orgSlug),
      listClinicSupplies(params.orgSlug),
    ])
    clinicSpecialties = specialties.filter(s => s.active)
    clinicProfessionals = professionals.filter(p => p.active)
    clinicRooms = rooms.filter(r => r.active)
    clinicAppointmentContexts = apptContexts
    clinicServiceContexts = Object.fromEntries((svcContextsRows.data || []).map((r: any) => [r.event_type_id, r]))
    reminderSettings = reminder
    clinicSupplies = supplies.filter(s => s.active).map(s => ({ id: s.id, name: s.name }))
  }

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
        isClinic={isClinic}
        clinicSpecialties={clinicSpecialties}
        clinicProfessionals={clinicProfessionals}
        clinicRooms={clinicRooms}
        clinicServiceContexts={clinicServiceContexts}
        clinicAppointmentContexts={clinicAppointmentContexts}
        clinicReminderSettings={reminderSettings}
        clinicSupplies={clinicSupplies}
      />
    </div>
  )
}
