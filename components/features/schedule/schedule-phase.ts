/**
 * Fase operacional da viagem (base das tabs de status) e detecção de
 * alerta — compartilhado entre ScheduleClient e ScheduleStatusTabs.
 */
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { type TripState } from './ScheduleGanttView'

const DAY = 86400000

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

export type TripPhase = 'pre' | 'em' | 'pos' | 'concluida' | 'cancelada'

/** Pós-viagem é uma janela de 15 dias após o retorno com tarefas em aberto
 *  (follow-up de pós-venda); depois disso, ou já com tudo em dia, vira
 *  Concluída. */
export function tripPhase(t: ScheduledTrip, today: Date): TripPhase {
  if (t.status === 'cancelled') return 'cancelada'
  const state = tripState(t, today)
  if (state === 'upcoming') return 'pre'
  if (state === 'ongoing') return 'em'
  const ret = parseDate(t.return_date) || parseDate(t.departure_date)
  const daysSinceReturn = ret ? Math.round((today.getTime() - ret.getTime()) / DAY) : 999
  if (daysSinceReturn <= 15 && t.health !== 'green') return 'pos'
  return 'concluida'
}

export function hasAlert(t: ScheduledTrip): boolean {
  if (t.health === 'red') return true
  return t.flights.some(f => f.status === 'cancelled' || f.status === 'diverted' || (f.delay_minutes || 0) > 0)
}
