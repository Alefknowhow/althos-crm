'use client'

/**
 * List view for ScheduleClient. Prop-driven, split out of
 * ScheduleClient.tsx. Grade de cards (guiada pelo anexo 2 do redesign) —
 * 2 colunas em telas largas pra caber várias viagens visíveis sem rolar
 * demais; o card em si é ScheduleTripCard.tsx.
 */

import type { ScheduledTrip } from '@/actions/travel-schedule'
import { type TripState } from './ScheduleGanttView'
import { ScheduleTripCard } from './ScheduleTripCard'

export function ScheduleListView({
  orgSlug, filtered, today, tripState, members, onOpenTrip,
}: {
  orgSlug: string
  filtered: ScheduledTrip[]
  today: Date
  tripState: (t: ScheduledTrip, today: Date) => TripState
  members: { user_id: string; name: string }[]
  onOpenTrip: (t: ScheduledTrip) => void
}) {
  if (filtered.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground rounded-lg border bg-card">Nenhuma viagem com esse filtro.</div>
  }

  return (
    <div className="space-y-3">
      <div className="grid lg:grid-cols-2 gap-3">
        {filtered.map(t => (
          <ScheduleTripCard
            key={t.id}
            orgSlug={orgSlug}
            t={t}
            today={today}
            tripState={tripState}
            sellerName={members.find(m => m.user_id === t.created_by)?.name}
            onOpenTrip={onOpenTrip}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} viagem{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
