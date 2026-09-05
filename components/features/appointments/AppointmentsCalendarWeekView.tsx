'use client'

import { useMemo } from 'react'
import type { CalendarAppointment } from './AppointmentsCalendarShared'
import {
  addDays,
  sameDay,
  fmtTime,
  statusOpacity,
  computeOverlapLayout,
  overlapStyle,
  pickFirst,
  DAY_NAMES_SHORT,
  HOUR_HEIGHT_PX,
} from './AppointmentsCalendarShared'

/* -------- Week view -------- */

export function WeekView({
  orgSlug: _orgSlug,
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
