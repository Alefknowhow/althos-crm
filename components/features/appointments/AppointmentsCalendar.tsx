'use client'

import { useMemo, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X, Check, MapPin, Mail, Phone, ExternalLink, User, CalendarPlus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ClinicAppointmentContext } from '@/actions/clinic'
import { CLINIC_STATUS_LABEL, CLINIC_STATUS_COLOR, CLINIC_STAGE_LEGEND, type ClinicStatus } from '@/lib/clinic-constants'
import { Calendar as MiniCalendar } from '@/components/ui/calendar'

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

type Mode = 'week' | 'month' | 'day'

type ClinicOption = {
  id: string
  name: string
  avatar_url?: string | null
  specialty_id?: string | null
  registration_no?: string | null
  commission_pct?: number | null
  phone?: string | null
  email?: string | null
}
type Availability = { id: string; day_of_week: number; start_time: string; end_time: string; event_type_id: string | null }

type Props = {
  orgSlug: string
  appointments: CalendarAppointment[]
  mode: Mode
  onCancel: (a: CalendarAppointment) => void
  onComplete: (a: CalendarAppointment) => void
  /** Só usado no modo 'day' (Agenda do dia, uma coluna por profissional) —
   *  nicho Clínicas. Nos demais modos/nichos ficam vazios/ignorados. */
  clinicProfessionals?: ClinicOption[]
  /** Nomes de especialidade, pra exibir no popup de detalhe do profissional
   *  (agenda do dia) — só o id fica em clinicProfessionals.specialty_id. */
  clinicSpecialties?: ClinicOption[]
  clinicContexts?: Record<string, ClinicAppointmentContext>
  /** Duplo clique num horário vazio (Semana/Dia) — abre o diálogo de novo
   *  agendamento prefilled. Sem isso os horários vazios não são clicáveis. */
  onSlotDoubleClick?: (date: Date, time: string, professionalId?: string) => void
  /** Horários configurados em "Horários disponíveis" — usados pra restringir
   *  Semana/Dia aos dias da semana e à faixa de horário realmente atendidos,
   *  em vez de sempre mostrar todos os 7 dias e a janela fixa 7h–21h. Sem
   *  nenhum horário configurado ainda, cai no fallback (todos os dias, 7–21h). */
  availabilities?: Availability[]
  /** Nicho Clínicas — habilita os botões rápidos de avançar estágio
   *  (Confirmar/Iniciar atendimento/Concluir/Não compareceu) e "Agendar
   *  retorno" no popup de detalhe do agendamento. */
  isClinic?: boolean
  onClinicStatusChange?: (a: CalendarAppointment, status: ClinicStatus, payment?: ClinicFinalizePayment) => void
  onScheduleReturn?: (a: CalendarAppointment) => void
}

/** Valor/forma de pagamento/parcelas capturados no momento de finalizar o
 *  atendimento (avançar pra 'realizado') — sobrescreve o preço de tabela
 *  do procedimento quando informado. */
export type ClinicFinalizePayment = {
  total_cents?: number | null
  discount_cents?: number
  payment_method?: string | null
  installments?: number | null
}

// Progressão padrão de status usada por plataformas de agenda consolidadas
// (Doctoralia, Boulevard etc.): um botão primário "próximo passo" por
// status, em vez de expor a máquina de estados inteira de uma vez.
const NEXT_CLINIC_STATUS: Partial<Record<ClinicStatus, ClinicStatus>> = {
  aguardando_confirmacao: 'confirmado',
  agendado: 'confirmado',
  confirmado: 'em_atendimento',
  em_atendimento: 'realizado',
}

// Rótulo do botão de "próximo passo" — mais concreto que o nome cru do
// status (ex.: "Paciente chegou" em vez de "Em atendimento"), pedido
// explicitamente pra refletir o check-in/check-out do dia a dia.
const NEXT_ACTION_LABEL: Partial<Record<ClinicStatus, string>> = {
  confirmado: 'Confirmar',
  em_atendimento: 'Paciente chegou',
  realizado: 'Finalizar atendimento',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro', boleto: 'Boleto', transferencia: 'Transferência',
}

function pickFirst<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null
  return Array.isArray(x) ? x[0] || null : x
}

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAY_NAMES_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function startOfWeek(d: Date): Date {
  // Week starts on Sunday to match the Brazilian default; tweak here if Monday-first is preferred.
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function statusOpacity(s: string): string {
  if (s === 'canceled') return 'opacity-40 line-through'
  if (s === 'completed') return 'opacity-70'
  return ''
}

function parseHour(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

// Fallback window pra quem ainda não configurou "Horários disponíveis" — sem
// isso o calendário ficaria vazio (0 dias, 0 horas) até o primeiro cadastro.
const FALLBACK_START_HOUR = 7
const FALLBACK_END_HOUR = 21

/** Faixa de horário a exibir na grade — min(início) a max(fim) entre todos
 *  os horários cadastrados, arredondado pra hora cheia. Sem cadastro, cai
 *  no fallback fixo. */
function computeHourRange(availabilities: Availability[]): { startHour: number; endHour: number } {
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
function computeAvailableDays(availabilities: Availability[]): Set<number> | null {
  if (availabilities.length === 0) return null
  return new Set(availabilities.map(a => a.day_of_week))
}

type OverlapSlot = { col: number; cols: number }

/**
 * Divide agendamentos que se sobrepõem no tempo em colunas lado a lado (como
 * Google Calendar/Doctoralia) — sem isso, 2 agendamentos simultâneos (ex.:
 * profissionais diferentes atendendo ao mesmo tempo) ficavam empilhados um
 * por cima do outro. Algoritmo guloso: cada evento entra na primeira coluna
 * cujo último evento já terminou antes dele começar; o nº de colunas de um
 * grupo (cluster transitivo de sobreposições) vale pra todo mundo nele, pra
 * uma sequência de horários escalonados não brigar por coluna 0.
 */
function computeOverlapLayout(appts: CalendarAppointment[]): Map<string, OverlapSlot> {
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
function overlapStyle(slot: OverlapSlot): { left: string; width: string } {
  const pct = 100 / slot.cols
  return {
    left: `calc(${slot.col * pct}% + 2px)`,
    width: `calc(${pct}% - 4px)`,
  }
}

/* -------- Week view -------- */

const HOUR_HEIGHT_PX = 72

function WeekView({
  orgSlug,
  weekStart,
  appointments,
  onSelect,
  hourRange,
  availableDays,
  onSlotDoubleClick,
}: {
  orgSlug: string
  weekStart: Date
  appointments: CalendarAppointment[]
  onSelect: (a: CalendarAppointment) => void
  hourRange: { startHour: number; endHour: number }
  availableDays: Set<number> | null
  onSlotDoubleClick?: (date: Date, time: string) => void
}) {
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const days = availableDays ? allDays.filter(d => availableDays.has(d.getDay())) : allDays
  const hours = Array.from({ length: hourRange.endHour - hourRange.startHour + 1 }, (_, i) => hourRange.startHour + i)

  // Group appointments by date (only visible days), only those that intersect the visible week.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>()
    for (const d of days) map.set(d.toDateString(), [])
    for (const a of appointments) {
      if (a.status === 'canceled') continue
      const start = new Date(a.start_time)
      const key = start.toDateString()
      if (map.has(key)) map.get(key)!.push(a)
    }
    return map
  }, [days, appointments])

  const today = new Date()

  // As larguras de coluna são dinâmicas (número de dias varia conforme os
  // horários cadastrados), então o grid usa inline style em vez de uma
  // classe Tailwind estática.
  const gridCols = `60px repeat(${days.length}, 1fr)`

  if (days.length === 0) {
    return (
      <div className="border rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
        Nenhum dia com horário cadastrado em &quot;Horários disponíveis&quot;.
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Day headers */}
      <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: gridCols }}>
        <div /> {/* gutter */}
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div
              key={i}
              className={`px-2 py-2 text-center border-l ${
                isToday ? 'bg-primary/5' : ''
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {DAY_NAMES_SHORT[d.getDay()]}
              </div>
              <div
                className={`text-lg font-semibold ${
                  isToday ? 'text-primary' : ''
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="grid relative" style={{ gridTemplateColumns: gridCols }}>
        {/* Hour gutter */}
        <div>
          {hours.map(h => (
            <div
              key={h}
              className="text-[10px] text-muted-foreground text-right pr-2 border-b border-border/60"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              <span className="relative -top-1.5">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, i) => {
          const appts = byDay.get(d.toDateString()) || []
          const overlapLayout = computeOverlapLayout(appts)
          return (
            <div
              key={i}
              className="relative border-l"
              style={{ height: hours.length * HOUR_HEIGHT_PX }}
            >
              {/* Hour divider lines — cada hora se divide em 2 faixas de 30min
                  clicáveis (duplo clique cria um agendamento nesse
                  dia/horário, igual ao padrão já usado em Tarefas). */}
              {onSlotDoubleClick ? (
                hours.map(h => (
                  <div key={h} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-border/60">
                    <button
                      type="button"
                      onDoubleClick={() => onSlotDoubleClick(d, `${String(h).padStart(2, '0')}:00`)}
                      title="Duplo clique para criar um agendamento"
                      className="block w-full text-left hover:bg-primary/5 border-b border-border/20"
                      style={{ height: HOUR_HEIGHT_PX / 2 }}
                    />
                    <button
                      type="button"
                      onDoubleClick={() => onSlotDoubleClick(d, `${String(h).padStart(2, '0')}:30`)}
                      title="Duplo clique para criar um agendamento"
                      className="block w-full text-left hover:bg-primary/5"
                      style={{ height: HOUR_HEIGHT_PX / 2 }}
                    />
                  </div>
                ))
              ) : (
                hours.map(h => (
                  <div
                    key={h}
                    className="border-b border-border/60"
                    style={{ height: HOUR_HEIGHT_PX }}
                  >
                    <div className="border-b border-border/20" style={{ height: HOUR_HEIGHT_PX / 2 }} />
                  </div>
                ))
              )}

              {/* Appointment blocks */}
              {appts.map(a => {
                const start = new Date(a.start_time)
                const end = new Date(a.end_time)
                const startHour = start.getHours() + start.getMinutes() / 60
                const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

                // Clamp to visible window so a 7am block stays visible even if start is 6:50.
                const visibleTop = Math.max(0, startHour - hourRange.startHour) * HOUR_HEIGHT_PX
                // Minimum 22px so a 15-min slot can still show a single line legibly.
                const visibleHeight = Math.max(22, durationHours * HOUR_HEIGHT_PX - 2)

                if (startHour >= hourRange.endHour + 1) return null
                if (startHour + durationHours <= hourRange.startHour) return null

                const et = pickFirst(a.event_types)
                const color = et?.color || '#3b82f6'
                const slot = overlapLayout.get(a.id) || { col: 0, cols: 1 }

                // Adaptive layout: pick what to show based on available height.
                //  - tiny  (<32px): just the name in a single line, tight padding
                //  - short (32–56): name + time, no event label
                //  - tall  (>=56): name + event + time
                const layout: 'tiny' | 'short' | 'tall' =
                  visibleHeight < 32 ? 'tiny' : visibleHeight < 56 ? 'short' : 'tall'
                const paddingCls = layout === 'tiny' ? 'px-1.5 py-0.5' : 'p-1.5'
                const textCls = layout === 'tiny' ? 'text-[10px]' : 'text-[11px]'

                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelect(a)}
                    className={`absolute rounded text-left leading-tight overflow-hidden border hover:z-10 transition-shadow ${paddingCls} ${textCls} ${statusOpacity(
                      a.status,
                    )}`}
                    style={{
                      top: visibleTop,
                      height: visibleHeight,
                      ...overlapStyle(slot),
                      backgroundColor: `${color}22`,
                      borderLeft: `3px solid ${color}`,
                    }}
                    title={`${a.guest_name} — ${et?.name || ''} (${fmtTime(a.start_time)} - ${fmtTime(a.end_time)})`}
                  >
                    {layout === 'tiny' ? (
                      // One-line layout: time + name truncated together.
                      <div className="flex items-baseline gap-1 truncate">
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {fmtTime(a.start_time)}
                        </span>
                        <span className="font-semibold truncate">{a.guest_name}</span>
                      </div>
                    ) : layout === 'short' ? (
                      <>
                        <div className="font-semibold truncate">{a.guest_name}</div>
                        <div className="text-muted-foreground tabular-nums">
                          {fmtTime(a.start_time)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold truncate">{a.guest_name}</div>
                        <div className="text-muted-foreground truncate">{et?.name || ''}</div>
                        <div className="text-muted-foreground tabular-nums">
                          {fmtTime(a.start_time)}
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -------- Day view (agenda do dia, uma coluna por profissional) -------- */

const UNASSIGNED_COL = '__unassigned__'

function DayProfessionalView({
  day,
  appointments,
  professionals,
  clinicSpecialties = [],
  contexts,
  onSelect,
  hourRange,
  onSlotDoubleClick,
}: {
  day: Date
  appointments: CalendarAppointment[]
  professionals: ClinicOption[]
  clinicSpecialties?: ClinicOption[]
  contexts: Record<string, ClinicAppointmentContext>
  onSelect: (a: CalendarAppointment) => void
  hourRange: { startHour: number; endHour: number }
  onSlotDoubleClick?: (date: Date, time: string, professionalId?: string) => void
}) {
  const [profilePopup, setProfilePopup] = useState<ClinicOption | null>(null)
  const specialtyName = (id: string | null | undefined) => clinicSpecialties.find(s => s.id === id)?.name || null
  const hours = Array.from({ length: hourRange.endHour - hourRange.startHour + 1 }, (_, i) => hourRange.startHour + i)

  // Linha vermelha de "agora" — só no dia de hoje, atualizada a cada minuto
  // (não precisa de mais frequência que isso pra uma linha de horário).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const isToday = sameDay(now, day)
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowOffsetPx = isToday && nowHour >= hourRange.startHour && nowHour <= hourRange.endHour + 1
    ? (nowHour - hourRange.startHour) * HOUR_HEIGHT_PX
    : null

  // Agenda do dia só existe pra quem tem agendamento no dia OU está cadastrado
  // ativo — mas colunas vazias (profissional sem nada hoje) ainda aparecem,
  // pra dar visão de disponibilidade. Um bucket "Sem profissional" aparece só
  // se existir algum agendamento do dia sem professional_id (dado legado ou
  // não preenchido), pra não sumir com o agendamento da agenda.
  const dayAppts = useMemo(
    () => appointments.filter(a => a.status !== 'canceled' && sameDay(new Date(a.start_time), day)),
    [appointments, day],
  )
  const hasUnassigned = dayAppts.some(a => !contexts[a.id]?.professional_id)
  const columns = useMemo(
    () => [...professionals, ...(hasUnassigned ? [{ id: UNASSIGNED_COL, name: 'Sem profissional' }] : [])],
    [professionals, hasUnassigned],
  )

  const byColumn = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>()
    for (const a of dayAppts) {
      const colId = contexts[a.id]?.professional_id || UNASSIGNED_COL
      if (!map.has(colId)) map.set(colId, [])
      map.get(colId)!.push(a)
    }
    return map
  }, [dayAppts, contexts])

  if (columns.length === 0) {
    return (
      <div className="border rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
        Cadastre profissionais em Profissionais para usar a agenda do dia.
      </div>
    )
  }

  // Largura fixa de coluna (nem espremida com poucos profissionais, nem
  // esticada exageradamente com muitos) — antes era minmax(160px, 1fr), que
  // esticava pra preencher a tela toda com 1-2 profissionais. overflow-x-auto
  // + min-w-max no wrapper já cuidam do scroll lateral quando excede a tela.
  const COLUMN_WIDTH_PX = 220
  const gridCols = `60px repeat(${columns.length}, ${COLUMN_WIDTH_PX}px)`

  return (
    <>
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap px-0.5 text-[11px] text-muted-foreground">
        {CLINIC_STAGE_LEGEND.map(item => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="border rounded-lg overflow-x-auto bg-card">
        <div className="min-w-max">
        {/* Column headers */}
        <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: gridCols }}>
          <div /> {/* gutter */}
          {columns.map(col => {
            const hasProfile = col.id !== UNASSIGNED_COL
            return (
              <div key={col.id} className="px-3 py-2 text-center border-l">
                <div className="flex items-center justify-center gap-1.5 text-sm font-semibold truncate">
                  <button
                    type="button"
                    disabled={!hasProfile}
                    onClick={() => hasProfile && setProfilePopup(col)}
                    title={hasProfile ? 'Ver dados do profissional' : undefined}
                    className={hasProfile ? 'shrink-0 rounded-full hover:ring-2 hover:ring-primary/40 transition-shadow' : 'shrink-0'}
                  >
                    {col.avatar_url ? (
                      <img src={col.avatar_url} alt={col.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    )}
                  </button>
                  <span className="truncate">{col.name}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid relative" style={{ gridTemplateColumns: gridCols }}>
          {isToday && nowOffsetPx != null && (
            <div
              className="absolute left-[60px] right-0 z-20 pointer-events-none flex items-center"
              style={{ top: nowOffsetPx }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
              <div className="flex-1 h-[2px] bg-red-500" />
            </div>
          )}
          <div>
            {hours.map(h => (
              <div
                key={h}
                className="text-[10px] text-muted-foreground text-right pr-2 border-b border-border/60"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                <span className="relative -top-1.5">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {columns.map(col => {
            const appts = byColumn.get(col.id) || []
            const overlapLayout = computeOverlapLayout(appts)
            return (
              <div key={col.id} className="relative border-l" style={{ height: hours.length * HOUR_HEIGHT_PX }}>
                {onSlotDoubleClick ? (
                  hours.map(h => (
                    <div key={h} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-border/60">
                      <button
                        type="button"
                        onDoubleClick={() => onSlotDoubleClick(day, `${String(h).padStart(2, '0')}:00`, col.id === UNASSIGNED_COL ? undefined : col.id)}
                        title="Duplo clique para criar um agendamento"
                        className="block w-full text-left hover:bg-primary/5 border-b border-border/20"
                        style={{ height: HOUR_HEIGHT_PX / 2 }}
                      />
                      <button
                        type="button"
                        onDoubleClick={() => onSlotDoubleClick(day, `${String(h).padStart(2, '0')}:30`, col.id === UNASSIGNED_COL ? undefined : col.id)}
                        title="Duplo clique para criar um agendamento"
                        className="block w-full text-left hover:bg-primary/5"
                        style={{ height: HOUR_HEIGHT_PX / 2 }}
                      />
                    </div>
                  ))
                ) : (
                  hours.map(h => (
                    <div key={h} className="border-b border-border/60" style={{ height: HOUR_HEIGHT_PX }}>
                      <div className="border-b border-border/20" style={{ height: HOUR_HEIGHT_PX / 2 }} />
                    </div>
                  ))
                )}

                {appts.map(a => {
                  const start = new Date(a.start_time)
                  const end = new Date(a.end_time)
                  const startHour = start.getHours() + start.getMinutes() / 60
                  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

                  const visibleTop = Math.max(0, startHour - hourRange.startHour) * HOUR_HEIGHT_PX
                  const visibleHeight = Math.max(22, durationHours * HOUR_HEIGHT_PX - 2)

                  if (startHour >= hourRange.endHour + 1) return null
                  if (startHour + durationHours <= hourRange.startHour) return null

                  const et = pickFirst(a.event_types)
                  const clinicStatus = contexts[a.id]?.clinic_status as ClinicStatus | undefined
                  // Cor por estágio do agendamento (chegou? em atendimento?
                  // finalizado? cancelado?) — não mais pelo procedimento, que
                  // já é identificado pelo nome no texto do card. Ver legenda
                  // no cabeçalho da agenda (CLINIC_STAGE_LEGEND).
                  const color = CLINIC_STATUS_COLOR[clinicStatus || 'agendado']
                  const slot = overlapLayout.get(a.id) || { col: 0, cols: 1 }
                  const layout: 'tiny' | 'short' | 'tall' =
                    visibleHeight < 32 ? 'tiny' : visibleHeight < 56 ? 'short' : 'tall'
                  const paddingCls = layout === 'tiny' ? 'px-1.5 py-0.5' : 'p-1.5'
                  const textCls = layout === 'tiny' ? 'text-[10px]' : 'text-[11px]'

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className={`absolute rounded text-left leading-tight overflow-hidden border hover:z-10 transition-shadow ${paddingCls} ${textCls} ${statusOpacity(a.status)}`}
                      style={{
                        top: visibleTop,
                        height: visibleHeight,
                        ...overlapStyle(slot),
                        backgroundColor: `${color}22`,
                        borderLeft: `3px solid ${color}`,
                      }}
                      title={`${a.guest_name} — ${et?.name || ''} (${fmtTime(a.start_time)} - ${fmtTime(a.end_time)}) — ${CLINIC_STATUS_LABEL[clinicStatus || 'agendado']}`}
                    >
                      {layout === 'tiny' ? (
                        <div className="flex items-baseline gap-1 truncate">
                          <span className="text-muted-foreground tabular-nums shrink-0">{fmtTime(a.start_time)}</span>
                          <span className="font-semibold truncate">{a.guest_name}</span>
                        </div>
                      ) : layout === 'short' ? (
                        <>
                          <div className="font-semibold truncate">{a.guest_name}</div>
                          <div className="text-muted-foreground truncate">{et?.name || ''}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold truncate">{a.guest_name}</div>
                          <div className="text-muted-foreground truncate">{et?.name || ''}</div>
                          <div className="text-muted-foreground tabular-nums">{fmtTime(a.start_time)}</div>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </div>

    <Dialog open={!!profilePopup} onOpenChange={o => !o && setProfilePopup(null)}>
      <DialogContent className="max-w-sm">
        {profilePopup && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {profilePopup.avatar_url ? (
                  <img src={profilePopup.avatar_url} alt={profilePopup.name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <span className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </span>
                )}
                <div>
                  <DialogTitle>{profilePopup.name}</DialogTitle>
                  {specialtyName(profilePopup.specialty_id) && (
                    <p className="text-sm text-muted-foreground">{specialtyName(profilePopup.specialty_id)}</p>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {profilePopup.registration_no && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Registro:</span> {profilePopup.registration_no}
                </div>
              )}
              {profilePopup.commission_pct != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Comissão:</span> {profilePopup.commission_pct}%
                </div>
              )}
              {profilePopup.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {profilePopup.phone}
                </div>
              )}
              {profilePopup.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" /> {profilePopup.email}
                </div>
              )}
              {!profilePopup.registration_no && profilePopup.commission_pct == null && !profilePopup.phone && !profilePopup.email && (
                <p className="text-muted-foreground">Sem dados adicionais cadastrados.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}

/* -------- Month view -------- */

function MonthView({
  monthStart,
  appointments,
  onSelect,
  availableDays,
}: {
  monthStart: Date
  appointments: CalendarAppointment[]
  onSelect: (a: CalendarAppointment) => void
  availableDays: Set<number> | null
}) {
  // Compute grid: start from Sunday before-or-on the 1st, render 6 weeks.
  const gridStart = startOfWeek(monthStart)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const today = new Date()

  // Bucket appointments by yyyy-mm-dd
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>()
    for (const a of appointments) {
      if (a.status === 'canceled') continue
      const d = new Date(a.start_time)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    // Sort each bucket by start time. Using Array.from to avoid downlevel iteration on Map.
    Array.from(map.values()).forEach((list: CalendarAppointment[]) => {
      list.sort(
        (a: CalendarAppointment, b: CalendarAppointment) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      )
    })
    return map
  }, [appointments])

  return (
    <div className="border rounded-lg overflow-hidden bg-card flex flex-col h-[calc(100vh-280px)] min-h-[420px]">
      <div className="grid grid-cols-7 border-b bg-muted/30 shrink-0">
        {DAY_NAMES_SHORT.map((d, i) => (
          <div
            key={d}
            className={`px-2 py-2 text-center text-[10px] uppercase tracking-wider font-medium border-l first:border-l-0 ${
              availableDays && !availableDays.has(i) ? 'text-muted-foreground/40' : 'text-muted-foreground'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* grid-rows-6 + flex-1 faz o mês inteiro caber na altura disponível
          sem precisar rolar a página — cada célula encolhe/cresce igual,
          em vez da altura fixa antiga (min-h-110px × 6 linhas estourava a
          viewport em telas mais baixas). */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === monthStart.getMonth()
          const isToday = sameDay(d, today)
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const list = byDate.get(key) || []
          const show = list.slice(0, 3)
          const overflow = list.length - show.length
          // Dia da semana sem horário cadastrado — deixa mais apagado (ainda
          // mostra os agendamentos que existirem, caso alguma exceção tenha
          // sido criada manualmente fora do expediente configurado).
          const isUnavailableWeekday = !!availableDays && !availableDays.has(d.getDay())

          return (
            <div
              key={i}
              className={`min-h-0 overflow-hidden border-l border-t first:border-l-0 p-1.5 text-xs ${
                !inMonth ? 'bg-muted/20 text-muted-foreground' : isUnavailableWeekday ? 'bg-muted/10' : ''
              }`}
              style={{ borderTopWidth: i < 7 ? 0 : 1 }}
            >
              <div
                className={`text-xs mb-1 ${
                  isToday
                    ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground font-semibold'
                    : 'font-medium'
                }`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {show.map(a => {
                  const et = pickFirst(a.event_types)
                  const color = et?.color || '#3b82f6'
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className={`block w-full text-left truncate rounded px-1 py-0.5 border-l-2 hover:bg-muted transition-colors ${statusOpacity(
                        a.status,
                      )}`}
                      style={{
                        borderLeftColor: color,
                        backgroundColor: `${color}11`,
                      }}
                      title={`${a.guest_name} — ${et?.name || ''} (${fmtTime(a.start_time)})`}
                    >
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {fmtTime(a.start_time)}
                      </span>
                      <span className="font-medium">{a.guest_name}</span>
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{overflow} mais</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -------- Main calendar shell with navigation + detail dialog -------- */

export default function AppointmentsCalendar({
  orgSlug,
  appointments,
  mode,
  onCancel,
  onComplete,
  clinicProfessionals = [],
  clinicSpecialties = [],
  clinicContexts = {},
  availabilities = [],
  onSlotDoubleClick,
  isClinic = false,
  onClinicStatusChange,
  onScheduleReturn,
}: Props) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<CalendarAppointment | null>(null)

  // Filtros de Semana/Mês (Dia já filtra por profissional via colunas) —
  // profissional específico e/ou só atrasados (horário já passou mas o
  // paciente ainda não chegou, nem foi cancelado/marcado como falta).
  const [professionalFilter, setProfessionalFilter] = useState<string>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const isOverdue = (a: CalendarAppointment) => {
    const status = clinicContexts[a.id]?.clinic_status
    const notStartedYet = !status || ['aguardando_confirmacao', 'agendado', 'confirmado', 'reagendado'].includes(status)
    return notStartedYet && new Date(a.start_time).getTime() < Date.now()
  }

  const filteredAppointments = useMemo(() => {
    let rows = appointments
    if (professionalFilter !== 'all') {
      rows = rows.filter(a => clinicContexts[a.id]?.professional_id === professionalFilter)
    }
    if (overdueOnly) {
      rows = rows.filter(isOverdue)
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, professionalFilter, overdueOnly, clinicContexts])

  const overdueCount = useMemo(() => appointments.filter(isOverdue).length, [appointments, clinicContexts])

  // Diálogo de "Finalizar atendimento" — captura valor/forma de pagamento/
  // parcelas antes de avançar o status pra 'realizado', em vez de sempre
  // cair no preço de tabela do procedimento.
  const [finalizeTarget, setFinalizeTarget] = useState<CalendarAppointment | null>(null)
  const [finalizeForm, setFinalizeForm] = useState({ total: '', discount: '', paymentMethod: '', installments: '' })

  function openFinalizeDialog(appt: CalendarAppointment) {
    setFinalizeTarget(appt)
    setFinalizeForm({ total: '', discount: '', paymentMethod: '', installments: '' })
  }

  function submitFinalize(e: React.FormEvent) {
    e.preventDefault()
    if (!finalizeTarget || !onClinicStatusChange) return
    onClinicStatusChange(finalizeTarget, 'realizado', {
      total_cents: finalizeForm.total ? Math.round(parseFloat(finalizeForm.total.replace(',', '.')) * 100) : undefined,
      discount_cents: finalizeForm.discount ? Math.round(parseFloat(finalizeForm.discount.replace(',', '.')) * 100) : undefined,
      payment_method: finalizeForm.paymentMethod || undefined,
      installments: finalizeForm.paymentMethod === 'credito' && finalizeForm.installments ? Number(finalizeForm.installments) : undefined,
    })
    setFinalizeTarget(null)
    setSelected(null)
  }

  const hourRange = useMemo(() => computeHourRange(availabilities), [availabilities])
  const availableDays = useMemo(() => computeAvailableDays(availabilities), [availabilities])

  const range = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(cursor)
      const end = addDays(start, 6)
      return { start, end }
    }
    if (mode === 'day') {
      const start = new Date(cursor)
      start.setHours(0, 0, 0, 0)
      return { start, end: start }
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    return { start, end }
  }, [cursor, mode])

  function go(direction: number) {
    const next = new Date(cursor)
    if (mode === 'week') next.setDate(next.getDate() + 7 * direction)
    else if (mode === 'day') next.setDate(next.getDate() + direction)
    else next.setMonth(next.getMonth() + direction)
    setCursor(next)
  }

  function goToday() {
    setCursor(new Date())
  }

  const label = useMemo(() => {
    if (mode === 'week') {
      const s = range.start
      const e = range.end
      const sameMonth = s.getMonth() === e.getMonth()
      const sameYear = s.getFullYear() === e.getFullYear()
      if (sameMonth) {
        return `${s.getDate()}–${e.getDate()} de ${MONTH_NAMES[s.getMonth()]} ${e.getFullYear()}`
      }
      if (sameYear) {
        return `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`
      }
      return `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getFullYear()} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`
    }
    if (mode === 'day') {
      return `${DAY_NAMES_LONG[range.start.getDay()]}, ${range.start.getDate()} de ${MONTH_NAMES[range.start.getMonth()]} ${range.start.getFullYear()}`
    }
    return `${MONTH_NAMES[range.start.getMonth()]} ${range.start.getFullYear()}`
  }, [range, mode])

  const selectedEt = selected ? pickFirst(selected.event_types) : null
  const selectedLead = selected ? pickFirst(selected.leads) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => go(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => go(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h2 className="text-sm font-semibold capitalize">{label}</h2>
        <div className="w-[120px]" /> {/* spacer to balance the row */}
      </div>

      {(mode === 'week' || mode === 'month') && clinicProfessionals.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={professionalFilter}
            onChange={e => setProfessionalFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">Todos os profissionais</option>
            {clinicProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button
            type="button"
            variant={overdueOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setOverdueOnly(v => !v)}
          >
            Atrasados{overdueCount > 0 ? ` (${overdueCount})` : ''}
          </Button>
        </div>
      )}

      {mode === 'week' ? (
        <WeekView
          orgSlug={orgSlug}
          weekStart={range.start}
          appointments={filteredAppointments}
          onSelect={setSelected}
          hourRange={hourRange}
          availableDays={availableDays}
          onSlotDoubleClick={onSlotDoubleClick}
        />
      ) : mode === 'day' ? (
        <div className="flex gap-3 items-start">
          <div className="hidden lg:block shrink-0">
            <MiniCalendar
              mode="single"
              selected={cursor}
              onSelect={d => d && setCursor(d)}
              className="border rounded-lg bg-card p-2"
            />
          </div>
          <div className="flex-1 min-w-0">
            <DayProfessionalView
              day={range.start}
              appointments={appointments}
              professionals={clinicProfessionals}
              clinicSpecialties={clinicSpecialties}
              contexts={clinicContexts}
              onSelect={setSelected}
              hourRange={hourRange}
              onSlotDoubleClick={onSlotDoubleClick}
            />
          </div>
        </div>
      ) : (
        <MonthView monthStart={range.start} appointments={filteredAppointments} onSelect={setSelected} availableDays={availableDays} />
      )}

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: selectedEt?.color || '#3b82f6' }}
                  />
                  {selectedEt?.name || 'Agendamento'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Quando</div>
                  <div className="font-medium">
                    {new Date(selected.start_time).toLocaleString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {selectedEt?.duration_minutes} min
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Cliente</div>
                  <div className="font-medium">{selected.guest_name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Mail className="w-3 h-3" /> {selected.guest_email}
                  </div>
                  {selected.guest_phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="w-3 h-3" /> {selected.guest_phone}
                    </div>
                  )}
                </div>

                {selected.location && (
                  <div>
                    <div className="text-xs text-muted-foreground">Local</div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="break-words">{selected.location}</span>
                    </div>
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <div className="text-xs text-muted-foreground">Notas do cliente</div>
                    <div className="italic">&quot;{selected.notes}&quot;</div>
                  </div>
                )}

                <div>
                  <Badge
                    className={
                      selected.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : selected.status === 'completed'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-red-100 text-red-700 border-red-200'
                    }
                  >
                    {selected.status === 'scheduled'
                      ? 'Agendado'
                      : selected.status === 'completed'
                        ? 'Concluído'
                        : 'Cancelado'}
                  </Badge>
                  {selected.canceled_reason && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {selected.canceled_reason}
                    </div>
                  )}
                </div>

                {isClinic && (() => {
                  const ctx = clinicContexts[selected.id]
                  const clinicStatus = ctx?.clinic_status as ClinicStatus | undefined
                  const nextStatus = clinicStatus ? NEXT_CLINIC_STATUS[clinicStatus] : undefined
                  const isTerminal = clinicStatus === 'cancelado' || clinicStatus === 'no_show' || clinicStatus === 'reagendado'
                  return (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1.5">Status clínico</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{CLINIC_STATUS_LABEL[clinicStatus || 'agendado']}</Badge>
                        {nextStatus && onClinicStatusChange && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (nextStatus === 'realizado') {
                                openFinalizeDialog(selected)
                              } else {
                                onClinicStatusChange(selected, nextStatus)
                              }
                            }}
                          >
                            {NEXT_ACTION_LABEL[nextStatus] || CLINIC_STATUS_LABEL[nextStatus]} <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {!isTerminal && clinicStatus !== 'realizado' && onClinicStatusChange && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => onClinicStatusChange(selected, 'no_show')}
                          >
                            Não compareceu
                          </Button>
                        )}
                      </div>
                      {(ctx?.checked_in_at || ctx?.finished_at) && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground space-x-3">
                          {ctx.checked_in_at && <span>Chegou às {new Date(ctx.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {ctx.finished_at && <span>Finalizou às {new Date(ctx.finished_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {selectedLead?.id && (
                  <Link
                    href={`/app/${orgSlug}/contatos/${selectedLead.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    Abrir lead ({selectedLead.name}) <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {(selected.status === 'scheduled' || (isClinic && onScheduleReturn)) && (
                <DialogFooter className="flex sm:justify-between gap-2 flex-wrap">
                  <div className="flex gap-2">
                    {selected.status === 'scheduled' && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          onCancel(selected)
                          setSelected(null)
                        }}
                        className="text-destructive"
                      >
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isClinic && onScheduleReturn && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          onScheduleReturn(selected)
                          setSelected(null)
                        }}
                      >
                        <CalendarPlus className="w-4 h-4 mr-1" /> Agendar retorno
                      </Button>
                    )}
                    {/* Nicho Clínicas usa só a progressão de status clínico (acima) —
                        ela já termina em "Realizado" e dispara o Atendimento +
                        lançamento em Financeiro. O botão genérico "Marcar
                        concluído" ficava como um segundo caminho que marcava
                        completed sem passar por esse fluxo. */}
                    {selected.status === 'scheduled' && !isClinic && (
                      <Button
                        onClick={() => {
                          onComplete(selected)
                          setSelected(null)
                        }}
                      >
                        <Check className="w-4 h-4 mr-1" /> Marcar concluído
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!finalizeTarget} onOpenChange={o => !o && setFinalizeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar atendimento</DialogTitle>
          </DialogHeader>
          {finalizeTarget && (
            <form onSubmit={submitFinalize} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {finalizeTarget.guest_name} — deixe em branco pra usar o preço de tabela do procedimento.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor cobrado (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={finalizeForm.total}
                    onChange={e => setFinalizeForm(f => ({ ...f, total: e.target.value }))}
                    placeholder="Preço de tabela"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Desconto (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={finalizeForm.discount}
                    onChange={e => setFinalizeForm(f => ({ ...f, discount: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de pagamento</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={finalizeForm.paymentMethod}
                    onChange={e => setFinalizeForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    <option value="">(Não informado)</option>
                    {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
                {finalizeForm.paymentMethod === 'credito' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Parcelas</Label>
                    <Input
                      type="number" min={1} max={24} step={1}
                      value={finalizeForm.installments}
                      onChange={e => setFinalizeForm(f => ({ ...f, installments: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">
                  <Check className="w-4 h-4 mr-1" /> Finalizar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
