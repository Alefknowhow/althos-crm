'use client'

import { useMemo } from 'react'
import type { CalendarAppointment } from './AppointmentsCalendarShared'
import { startOfWeek, addDays, sameDay, fmtTime, statusOpacity, pickFirst, DAY_NAMES_SHORT } from './AppointmentsCalendarShared'

/* -------- Month view -------- */

export function MonthView({
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
