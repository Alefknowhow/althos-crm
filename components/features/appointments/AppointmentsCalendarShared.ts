// Shared types/helpers used by AppointmentsCalendar.tsx and its extracted
// view components (Week/Day/Month). Pure code motion — no behavior change.

export type CalendarAppointment = {
  id: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'canceled' | 'completed'
  guest_name: string
  guest_email: string
  guest_phone: string | null
  location: string | null
  notes?: string | null
  canceled_reason: string | null
  event_type_id: string
  contato_id: string | null
  event_types: { name: string; color: string | null; duration_minutes: number } | { name: string; color: string | null; duration_minutes: number }[] | null
  leads: { id: string; name: string } | { id: string; name: string }[] | null
}

export type ClinicOption = {
  id: string
  name: string
  avatar_url?: string | null
  specialty_id?: string | null
  registration_no?: string | null
  commission_pct?: number | null
  phone?: string | null
  email?: string | null
}

export type Availability = { id: string; day_of_week: number; start_time: string; end_time: string; event_type_id: string | null }

export function pickFirst<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null
  return Array.isArray(x) ? x[0] || null : x
}

export const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DAY_NAMES_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function startOfWeek(d: Date): Date {
  // Week starts on Sunday to match the Brazilian default; tweak here if Monday-first is preferred.
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function statusOpacity(s: string): string {
  if (s === 'canceled') return 'opacity-40 line-through'
  if (s === 'completed') return 'opacity-70'
  return ''
}

export function parseHour(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

// Fallback window pra quem ainda não configurou "Horários disponíveis" — sem
// isso o calendário ficaria vazio (0 dias, 0 horas) até o primeiro cadastro.
export const FALLBACK_START_HOUR = 7
export const FALLBACK_END_HOUR = 21

/** Faixa de horário a exibir na grade — min(início) a max(fim) entre todos
 *  os horários cadastrados, arredondado pra hora cheia. Sem cadastro, cai
 *  no fallback fixo. */
export function computeHourRange(availabilities: Availability[]): { startHour: number; endHour: number } {
  if (availabilities.length === 0) return { startHour: FALLBACK_START_HOUR, endHour: FALLBACK_END_HOUR }
  let start = Infinity
  let end = -Infinity
  for (const a of availabilities) {
    start = Math.min(start, Math.floor(parseHour(a.start_time)))
    end = Math.max(end, Math.ceil(parseHour(a.end_time)))
  }
  return { startHour: start, endHour: end }
}

/** Dias da semana (0=domingo…6=sábado) com pelo menos um horário cadastrado.
 *  `null` = sem cadastro nenhum ainda → não filtra, mostra os 7 dias. */
export function computeAvailableDays(availabilities: Availability[]): Set<number> | null {
  if (availabilities.length === 0) return null
  return new Set(availabilities.map(a => a.day_of_week))
}

export type OverlapSlot = { col: number; cols: number }

/**
 * Divide agendamentos que se sobrepõem no tempo em colunas lado a lado (como
 * Google Calendar/Doctoralia) — sem isso, 2 agendamentos simultâneos (ex.:
 * profissionais diferentes atendendo ao mesmo tempo) ficavam empilhados um
 * por cima do outro. Algoritmo guloso: cada evento entra na primeira coluna
 * cujo último evento já terminou antes dele começar; o nº de colunas de um
 * grupo (cluster transitivo de sobreposições) vale pra todo mundo nele, pra
 * uma sequência de horários escalonados não brigar por coluna 0.
 */
export function computeOverlapLayout(appts: CalendarAppointment[]): Map<string, OverlapSlot> {
  const layout = new Map<string, OverlapSlot>()
  const sorted = [...appts].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  let cluster: CalendarAppointment[] = []
  let clusterEnd = -Infinity

  function flushCluster() {
    if (cluster.length === 0) return
    const colEnds: number[] = []
    const colOf = new Map<string, number>()
    for (const a of cluster) {
      const start = new Date(a.start_time).getTime()
      const end = new Date(a.end_time).getTime()
      let placed = false
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= start) {
          colEnds[c] = end
          colOf.set(a.id, c)
          placed = true
          break
        }
      }
      if (!placed) {
        colEnds.push(end)
        colOf.set(a.id, colEnds.length - 1)
      }
    }
    const cols = colEnds.length
    for (const a of cluster) layout.set(a.id, { col: colOf.get(a.id)!, cols })
    cluster = []
  }

  for (const a of sorted) {
    const start = new Date(a.start_time).getTime()
    const end = new Date(a.end_time).getTime()
    if (cluster.length > 0 && start >= clusterEnd) {
      flushCluster()
      clusterEnd = -Infinity
    }
    cluster.push(a)
    clusterEnd = Math.max(clusterEnd, end)
  }
  flushCluster()

  return layout
}

/** left/width em % pra um bloco dentro da coluna, considerando quantas
 *  colunas o overlap layout pediu — com um pequeno gap entre elas. */
export function overlapStyle(slot: OverlapSlot): { left: string; width: string } {
  const pct = 100 / slot.cols
  return {
    left: `calc(${slot.col * pct}% + 2px)`,
    width: `calc(${pct}% - 4px)`,
  }
}

export const HOUR_HEIGHT_PX = 72
