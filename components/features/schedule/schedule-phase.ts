/**
 * Fase operacional da viagem (upcoming/ongoing/past) — usada pela etiqueta
 * de Embarque (issue #9 § 3.1) e pelo painel de detalhe. Compartilhado
 * entre vários componentes de Embarques.
 */
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { type TripState } from './ScheduleGanttView'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

export function tripState(t: ScheduledTrip, today: Date): TripState {
  const dep = parseDate(t.departure_date)
  const ret = parseDate(t.return_date) || dep
  if (!dep) return 'upcoming'
  const end = ret || dep
  if (end < today) return 'past'
  if (dep <= today && today <= end) return 'ongoing'
  return 'upcoming'
}
