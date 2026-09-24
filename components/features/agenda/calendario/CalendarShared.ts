/**
 * Types e helpers puros da visão Calendário (Agenda → Calendário, issue
 * #14). Reaproveita os helpers de data genéricos de TasksBoardShared em vez
 * de duplicar (startOfMonth/addMonths/startOfWeek/addWeeks/ymd/WEEKDAYS_PT).
 */
import type { EventRow } from '@/actions/events'
import { startOfMonth, addMonths, startOfWeek, addDays, ymd } from '@/components/features/tasks/TasksBoardShared'

export type CalView = 'month' | 'week' | 'day'

export function rangeForView(view: CalView, anchor: Date): { from: string; to: string } {
  if (view === 'day') {
    return { from: `${ymd(anchor)}T00:00:00.000Z`, to: `${ymd(anchor)}T23:59:59.999Z` }
  }
  if (view === 'week') {
    const start = startOfWeek(anchor)
    const end = addDays(start, 6)
    return { from: `${ymd(start)}T00:00:00.000Z`, to: `${ymd(end)}T23:59:59.999Z` }
  }
  // month — inclui os dias da grade que "vazam" pro mês anterior/seguinte.
  const monthStart = startOfMonth(anchor)
  const gridStart = startOfWeek(monthStart)
  const monthEnd = addMonths(monthStart, 1)
  const gridEnd = addDays(startOfWeek(monthEnd), 6)
  return { from: `${ymd(gridStart)}T00:00:00.000Z`, to: `${ymd(gridEnd)}T23:59:59.999Z` }
}

/** Chave YYYY-MM-DD local do início do evento — usada pra agrupar por dia
 *  nas 3 visões. Eventos "dia inteiro" são âncorados em UTC (mesma
 *  convenção de due_date em tasks), os demais usam o instante local. */
export function eventDayKey(e: EventRow): string {
  if (e.all_day) return e.start_at.split('T')[0]
  return ymd(new Date(e.start_at))
}

export function eventTimeLabel(e: EventRow): string {
  if (e.all_day) return 'Dia inteiro'
  const start = new Date(e.start_at)
  const end = new Date(e.end_at)
  const fmt = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function groupEventsByDay(events: EventRow[]): Map<string, EventRow[]> {
  const map = new Map<string, EventRow[]>()
  for (const e of events) {
    const key = eventDayKey(e)
    const list = map.get(key) ?? []
    list.push(e)
    map.set(key, list)
  }
  for (const list of Array.from(map.values())) {
    list.sort((a, b) => a.start_at.localeCompare(b.start_at))
  }
  return map
}

export const EVENT_STATUS_LABEL: Record<EventRow['status'], string> = {
  scheduled: 'Agendado',
  canceled: 'Cancelado',
}
