'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Calendar, Clock, List } from 'lucide-react'
import EventTypesPanel from './EventTypesPanel'
import AvailabilityPanel from './AvailabilityPanel'
import AppointmentsListPanel from './AppointmentsListPanel'

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

type Props = {
  orgSlug: string
  eventTypes: EventType[]
  availabilities: Availability[]
  upcoming: any[]
  past: any[]
  pipelines: Pipeline[]
  stages: Stage[]
}

export default function AppointmentsAdminTabs(props: Props) {
  return (
    <Tabs defaultValue="event-types" className="space-y-4">
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

      <TabsContent value="event-types">
        <EventTypesPanel
          orgSlug={props.orgSlug}
          eventTypes={props.eventTypes}
          pipelines={props.pipelines}
          stages={props.stages}
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
        />
      </TabsContent>
    </Tabs>
  )
}
