'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Calendar, Clock, List } from 'lucide-react'
import EventTypesPanel from './EventTypesPanel'
import AvailabilityPanel from './AvailabilityPanel'
import AppointmentsListPanel from './AppointmentsListPanel'
import type { ClinicServiceContext, ClinicAppointmentContext } from '@/actions/clinic'

type EventType = {
  id: string
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  color: string | null
  location: string | null
  is_active: boolean
  buffer_before_minutes: number
  buffer_after_minutes: number
  pipeline_id: string | null
  stage_id: string | null
}

type Availability = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  event_type_id: string | null
}

type Pipeline = { id: string; name: string; is_default: boolean }
type Stage = { id: string; name: string; pipeline_id: string }
type ClinicOption = { id: string; name: string }

type Props = {
  orgSlug: string
  eventTypes: EventType[]
  availabilities: Availability[]
  upcoming: any[]
  past: any[]
  pipelines: Pipeline[]
  stages: Stage[]
  isClinic?: boolean
  clinicSpecialties?: ClinicOption[]
  clinicProfessionals?: ClinicOption[]
  clinicRooms?: ClinicOption[]
  clinicServiceContexts?: Record<string, ClinicServiceContext>
  clinicAppointmentContexts?: Record<string, ClinicAppointmentContext>
}

export default function AppointmentsAdminTabs(props: Props) {
  return (
    <Tabs defaultValue="event-types" className="space-y-4">
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-2 -mt-2 pb-2 bg-background">
        <TabsList>
          <TabsTrigger value="event-types" className="gap-2">
            <Calendar className="w-4 h-4" /> Tipos de evento
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-2">
            <Clock className="w-4 h-4" /> Horários disponíveis
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-2">
            <List className="w-4 h-4" /> Agendamentos
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="event-types">
        <EventTypesPanel
          orgSlug={props.orgSlug}
          eventTypes={props.eventTypes}
          pipelines={props.pipelines}
          stages={props.stages}
          isClinic={props.isClinic}
          clinicSpecialties={props.clinicSpecialties}
          clinicRooms={props.clinicRooms}
          clinicServiceContexts={props.clinicServiceContexts}
        />
      </TabsContent>

      <TabsContent value="availability">
        <AvailabilityPanel
          orgSlug={props.orgSlug}
          eventTypes={props.eventTypes}
          initialAvailabilities={props.availabilities}
        />
      </TabsContent>

      <TabsContent value="appointments">
        <AppointmentsListPanel
          orgSlug={props.orgSlug}
          upcoming={props.upcoming}
          past={props.past}
          eventTypes={props.eventTypes}
          isClinic={props.isClinic}
          clinicProfessionals={props.clinicProfessionals}
          clinicRooms={props.clinicRooms}
          clinicContexts={props.clinicAppointmentContexts}
        />
      </TabsContent>
    </Tabs>
  )
}
