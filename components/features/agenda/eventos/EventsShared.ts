/**
 * Types e helpers puros da visão Agenda → Eventos. Reaproveita os helpers de
 * data genéricos de TasksBoardShared em vez de duplicar (startOfMonth/
 * addMonths/startOfWeek/addWeeks/ymd/WEEKDAYS_PT) — só a matemática de data,
 * nunca o motor de Tasks: Eventos tem base (events) e UI isoladas de Tasks,
 * por pedido explícito (set/2026).
 */
import type { EventRow } from '@/actions/events'
import { startOfMonth, startOfWeek, addDays, ymd } from '@/components/features/tasks/TasksBoardShared'

export type CalView = 'month' | 'week'

export function rangeForView(view: CalView, anchor: Date): { from: string; to: string } {
  if (view === 'week') {
    const start = startOfWeek(anchor)
    const end = addDays(start, 6)
    return { from: `${ymd(start)}T00:00:00.000Z`, to: `${ymd(end)}T23:59:59.999Z` }
  }
  // month — a grade sempre desenha 42 dias (6 linhas fixas, EventsMonthGrid),
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

export function addDaysToYmd(value: string, n: number): string {
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

export const ROW_H = 64 // px por hora, na timeline de Semana/Dia

/** Minutos desde 00:00 do wall-clock ancorado (mesma convenção de
 *  eventTimeLabel/utcDateOnly acima) — nunca usar getters locais aqui. */
function minutesOfDayUTC(iso: string): number {
  const t = iso.split('T')[1]?.slice(0, 5) ?? '00:00'
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Recorte [startMin, endMin) do evento dentro de um dia específico —
 *  eventos de vários dias mostram só a fatia que cabe em cada dia (meia-
 *  noite a meia-noite nos dias do meio), igual Google Agenda. */
export function eventDaySegment(e: EventRow, dayKey: string): { startMin: number; endMin: number } {
  const keys = dayKeysForEvent(e)
  const isFirst = keys[0] === dayKey
  const isLast = keys[keys.length - 1] === dayKey
  const startMin = isFirst ? minutesOfDayUTC(e.start_at) : 0
  const endMin = isLast ? minutesOfDayUTC(e.end_at) : 24 * 60
  return { startMin, endMin: Math.max(endMin, startMin + 15) }
}

/** Agrupa eventos do dia por INTERSECÇÃO de intervalo (não por igualdade de
 *  horário de início) e atribui coluna/largura a cada um — dois eventos que
 *  só se sobrepõem parcialmente (ex.: 10h–12h e 11h–13h) precisam dividir
 *  espaço horizontal mesmo com starts diferentes, senão um cobre o outro
 *  (achado da revisão do PR #55). Clusteriza por varredura (eventos
 *  ordenados por início; um novo cluster começa quando o próximo evento
 *  começa depois do fim máximo já visto no cluster atual) e, dentro de cada
 *  cluster, aloca colunas de forma gulosa (primeira coluna livre). */
export function computeOverlapLayout(events: { id: string; startMin: number; endMin: number }[]): Map<string, { col: number; cols: number }> {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const result = new Map<string, { col: number; cols: number }>()

  let cluster: typeof sorted = []
  let clusterMaxEnd = -Infinity

  function flush() {
    if (cluster.length === 0) return
    const columnEnds: number[] = []
    const colOf = new Map<string, number>()
    for (const ev of cluster) {
      let col = columnEnds.findIndex(end => end <= ev.startMin)
      if (col === -1) { col = columnEnds.length; columnEnds.push(ev.endMin) }
      else columnEnds[col] = ev.endMin
      colOf.set(ev.id, col)
    }
    const cols = columnEnds.length
    for (const ev of cluster) result.set(ev.id, { col: colOf.get(ev.id)!, cols })
    cluster = []
    clusterMaxEnd = -Infinity
  }

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.startMin >= clusterMaxEnd) flush()
    cluster.push(ev)
    clusterMaxEnd = Math.max(clusterMaxEnd, ev.endMin)
  }
  flush()

  return result
}

/** Faixa de horas da timeline: padrão comercial (7h–20h), expandida se
 *  algum evento com horário visível ficar fora desse intervalo — mesmo
 *  espírito de useTasksBoardGrid (removido de Tasks, hoje só existe aqui). */
export function computeHourRange(days: Date[], eventsByDay: Map<string, EventRow[]>): { start: number; end: number } {
  let min = 7
  let max = 20
  for (const d of days) {
    const key = ymd(d)
    for (const e of eventsByDay.get(key) || []) {
      if (e.all_day) continue
      const { startMin, endMin } = eventDaySegment(e, key)
      const startH = Math.floor(startMin / 60)
      const endH = Math.ceil(endMin / 60)
      if (startH < min) min = startH
      if (endH > max) max = endH
    }
  }
  return { start: min, end: Math.min(max, 24) }
}
