'use client'

/**
 * Conteúdo da aba isolada "Linha do tempo" — uma barra animada "Ida →
 * Volta" por viagem (anexo 3 do redesign), com o nome do cliente
 * centralizado. Substitui o antigo gráfico de Gantt mensal nessa aba.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { type TripState } from './ScheduleGanttView'
import { rowStatus } from './ScheduleTripDetail'
import { ScheduleTripTimelineBar } from './ScheduleTripTimelineBar'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

export function ScheduleTimelineListView({
  filtered, today, tripState, onOpenTrip,
}: {
  filtered: ScheduledTrip[]
  today: Date
  tripState: (t: ScheduledTrip, today: Date) => TripState
  onOpenTrip: (t: ScheduledTrip) => void
}) {
  if (filtered.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground rounded-lg border bg-card">Nenhuma viagem com esse filtro.</div>
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map(t => {
        const state = tripState(t, today)
        const dep = parseDate(t.departure_date)
        const ret = parseDate(t.return_date)
        const status = rowStatus(t, state, dep, today)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenTrip(t)}
            className="rounded-lg border bg-card p-3 text-left hover:bg-muted/30 transition-colors space-y-2"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{t.client_name || t.lead_name || 'Cliente'}</span>
              {t.destination && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
                  <MapPin className="w-3 h-3" /> {t.destination}
                </span>
              )}
              <Badge variant="outline" className={cn('shrink-0 text-[10px]', status.badge)}>{status.label}</Badge>
            </div>
            <ScheduleTripTimelineBar departure={dep} returnDate={ret} destination={t.destination} clientName={t.client_name} />
          </button>
        )
      })}
    </div>
  )
}
