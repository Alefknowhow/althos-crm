/**
 * Types e helpers puros da visão Calendário (Agenda → Calendário, issue
 * #14). Reaproveita os helpers de data genéricos de TasksBoardShared em vez
 * de duplicar (startOfMonth/addMonths/startOfWeek/addWeeks/ymd/WEEKDAYS_PT).
 */
import type { EventRow } from '@/actions/events'
import { startOfMonth, startOfWeek, addDays, ymd } from '@/components/features/tasks/TasksBoardShared'

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
  // month — a grade sempre desenha 42 dias (6 linhas fixas, CalendarMonthGrid),
  // então a janela consultada tem que cobrir os 42, não só até o fim da
  // semana do 1º dia do mês seguinte (que em meses de 5 linhas fica curta
  // e deixa a 6ª linha sem eventos).
  const monthStart = startOfMonth(anchor)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = addDays(gridStart, 41)
  return { from: `${ymd(gridStart)}T00:00:00.000Z`, to: `${ymd(gridEnd)}T23:59:59.999Z` }
}

/** Data (YYYY-MM-DD) literal embutida no ISO — start_at/end_at sempre vêm de
 *  combineDateTime() (actions/events.ts), que ancora o wall-clock escolhido
 *  com sufixo 'Z' (mesma convenção de due_date em tasks); ler os 10
 *  primeiros chars de volta é o inverso exato dessa âncora, não uma
 *  conversão de fuso — extrair via `new Date(...)` com getters locais (como
 *  o antigo eventDayKey fazia pros eventos com horário) quebraria isso fora
 *  de UTC-0. */
function utcDateOnly(iso: string): string {
  return iso.split('T')[0]
}

function addDaysToYmd(value: string, n: number): string {
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}

/** Todo dia (YYYY-MM-DD) coberto pelo intervalo [start_at, end_at] do
 *  evento, inclusive — evento de vários dias precisa aparecer em cada um
 *  deles, não só no dia do início. Teto de 60 dias evita loop indevido se
 *  algum dado vier com end_at absurdamente distante. */
export function dayKeysForEvent(e: EventRow): string[] {
  const startKey = utcDateOnly(e.start_at)
  const endKey = utcDateOnly(e.end_at)
  if (startKey === endKey) return [startKey]
  const keys: string[] = []
  let cur = startKey
  let i = 0
  while (cur <= endKey && i < 60) {
    keys.push(cur)
    cur = addDaysToYmd(cur, 1)
    i++
  }
  return keys
}

export function eventTimeLabel(e: EventRow): string {
  if (e.all_day) return 'Dia inteiro'
  const start = new Date(e.start_at)
  const end = new Date(e.end_at)
  // timeZone: 'UTC' é obrigatório aqui — o horário armazenado é o
  // wall-clock ancorado (ver utcDateOnly acima); sem forçar UTC,
  // toLocaleTimeString reconverte pro fuso do navegador e mostra um horário
  // diferente do que foi escolhido em qualquer fuso ≠ UTC-0.
  const fmt = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function groupEventsByDay(events: EventRow[]): Map<string, EventRow[]> {
  const map = new Map<string, EventRow[]>()
  for (const e of events) {
    for (const key of dayKeysForEvent(e)) {
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
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
