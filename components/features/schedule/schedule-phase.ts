/**
 * Fase operacional da viagem (upcoming/ongoing/past) — usada pela etiqueta
 * de Embarque (issue #9 § 3.1) e pelo painel de detalhe. Compartilhado
 * entre vários componentes de Embarques.
 */
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { type TripState } from './ScheduleGanttView'

const DAY = 86400000

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

/** Diferença em dias de calendário entre uma data de embarque (`dep`, sempre
 *  parseada ao meio-dia por `parseDate` pra evitar problemas de DST) e
 *  `today` (sempre meia-noite, ver `startOfDay` em ScheduleClient) —
 *  normaliza `dep` pra meia-noite antes de subtrair, senão a diferença de
 *  meio dia arredonda pro dia errado (ex.: embarque hoje ao meio-dia contava
 *  como "1 dia", bug real corrigido na issue #9). Usar em todo lugar que
 *  precisa de "faltam N dias"/"Hoje"/"Amanhã" — nunca comparar
 *  `dep.getTime()` com `today.getTime()` direto. */
export function daysFromToday(dep: Date, today: Date): number {
  const depMidnight = new Date(dep)
  depMidnight.setHours(0, 0, 0, 0)
  return Math.round((depMidnight.getTime() - today.getTime()) / DAY)
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
