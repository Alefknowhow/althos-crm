'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X, Check, MapPin, Mail, Phone, ExternalLink } from 'lucide-react'
import Link from 'next/link'

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
  lead_id: string | null
  event_types: { name: string; color: string | null; duration_minutes: number } | { name: string; color: string | null; duration_minutes: number }[] | null
  leads: { id: string; name: string } | { id: string; name: string }[] | null
}

type Mode = 'week' | 'month'

type Props = {
  orgSlug: string
  appointments: CalendarAppointment[]
  mode: Mode
  onCancel: (a: CalendarAppointment) => void
  onComplete: (a: CalendarAppointment) => void
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

/* -------- Week view -------- */

// Visible time window — tweak here if the org typically books outside 8–20.
const WEEK_START_HOUR = 7
const WEEK_END_HOUR = 21
const HOUR_HEIGHT_PX = 56

function WeekView({
  orgSlug,
  weekStart,
  appointments,
  onSelect,
}: {
  orgSlug: string
  weekStart: Date
  appointments: CalendarAppointment[]
  onSelect: (a: CalendarAppointment) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR + 1 }, (_, i) => WEEK_START_HOUR + i)

  // Group appointments by day-of-week index, only those that intersect the visible week.
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarAppointment[]>()
    const weekEnd = addDays(weekStart, 7)
    for (const a of appointments) {
      const start = new Date(a.start_time)
      if (start < weekStart || start >= weekEnd) continue
      const idx = Math.floor((start.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
      if (!map.has(idx)) map.set(idx, [])
      map.get(idx)!.push(a)
    }
    return map
  }, [weekStart, appointments])

  const today = new Date()

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
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
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
        {/* Hour gutter */}
        <div>
          {hours.map(h => (
            <div
              key={h}
              className="text-[10px] text-muted-foreground text-right pr-2 border-b border-border/40"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              <span className="relative -top-1.5">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, i) => {
          const appts = (byDay.get(i) || []).filter(a => a.status !== 'canceled')
          return (
            <div
              key={i}
              className="relative border-l"
              style={{ height: hours.length * HOUR_HEIGHT_PX }}
            >
              {/* Hour divider lines */}
              {hours.map(h => (
                <div
                  key={h}
                  className="border-b border-border/40"
                  style={{ height: HOUR_HEIGHT_PX }}
                />
              ))}

              {/* Appointment blocks */}
              {appts.map(a => {
                const start = new Date(a.start_time)
                const end = new Date(a.end_time)
                const startHour = start.getHours() + start.getMinutes() / 60
                const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

                // Clamp to visible window so a 7am block stays visible even if start is 6:50.
                const visibleTop = Math.max(0, startHour - WEEK_START_HOUR) * HOUR_HEIGHT_PX
                // Minimum 22px so a 15-min slot can still show a single line legibly.
                const visibleHeight = Math.max(22, durationHours * HOUR_HEIGHT_PX - 2)

                if (startHour >= WEEK_END_HOUR + 1) return null
                if (startHour + durationHours <= WEEK_START_HOUR) return null

                const et = pickFirst(a.event_types)
                const color = et?.color || '#3b82f6'

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
                    className={`absolute left-1 right-1 rounded text-left leading-tight overflow-hidden border shadow-sm hover:shadow-md hover:z-10 transition-shadow ${paddingCls} ${textCls} ${statusOpacity(
                      a.status,
                    )}`}
                    style={{
                      top: visibleTop,
                      height: visibleHeight,
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

/* -------- Month view -------- */

function MonthView({
  monthStart,
  appointments,
  onSelect,
}: {
  monthStart: Date
  appointments: CalendarAppointment[]
  onSelect: (a: CalendarAppointment) => void
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
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAY_NAMES_SHORT.map(d => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-l first:border-l-0"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === monthStart.getMonth()
          const isToday = sameDay(d, today)
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const list = byDate.get(key) || []
          const show = list.slice(0, 3)
          const overflow = list.length - show.length

          return (
            <div
              key={i}
              className={`min-h-[110px] border-l border-t first:border-l-0 p-1.5 text-xs ${
                !inMonth ? 'bg-muted/20 text-muted-foreground' : ''
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
}: Props) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<CalendarAppointment | null>(null)

  const range = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(cursor)
      const end = addDays(start, 6)
      return { start, end }
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    return { start, end }
  }, [cursor, mode])

  function go(direction: number) {
    const next = new Date(cursor)
    if (mode === 'week') next.setDate(next.getDate() + 7 * direction)
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

      {mode === 'week' ? (
        <WeekView
          orgSlug={orgSlug}
          weekStart={range.start}
          appointments={appointments}
          onSelect={setSelected}
        />
      ) : (
        <MonthView monthStart={range.start} appointments={appointments} onSelect={setSelected} />
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
                    <div className="italic">"{selected.notes}"</div>
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

                {selectedLead?.id && (
                  <Link
                    href={`/app/${orgSlug}/leads/${selectedLead.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    Abrir lead ({selectedLead.name}) <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {selected.status === 'scheduled' && (
                <DialogFooter className="flex sm:justify-between gap-2">
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
                  <Button
                    onClick={() => {
                      onComplete(selected)
                      setSelected(null)
                    }}
                  >
                    <Check className="w-4 h-4 mr-1" /> Marcar concluído
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
