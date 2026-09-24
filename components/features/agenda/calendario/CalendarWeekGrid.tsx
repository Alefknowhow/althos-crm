'use client'

/** Visão Semana do Calendário — 7 colunas (Dom–Sáb), cada uma com a lista
 *  de eventos do dia ordenada por horário. Mais simples que uma grade por
 *  hora (suficiente para o MVP da issue #14; TasksBoardCalendarPanel.tsx
 *  tem a versão por-hora, caso vire necessário depois). */

import { cn } from '@/lib/utils'
import { WEEKDAYS_PT, ymd } from '@/components/features/tasks/TasksBoardShared'
import { eventTimeLabel } from './CalendarShared'
import type { EventRow } from '@/actions/events'
import EmptyState from '@/components/ui/empty-state'
import { CalendarDays } from 'lucide-react'

export default function CalendarWeekGrid({
  weekDays, todayYmd, eventsByDay, onDayClick, onOpenEvent,
}: {
  weekDays: Date[]
  todayYmd: string
  eventsByDay: Map<string, EventRow[]>
  onDayClick: (d: string) => void
  onOpenEvent: (event: EventRow) => void
}) {
  const hasAny = weekDays.some(d => (eventsByDay.get(ymd(d)) || []).length > 0)

  return (
    <div className="rounded-[8px] border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((d, i) => {
          const key = ymd(d)
          const isToday = key === todayYmd
          return (
            <button
              type="button"
              key={key}
              onClick={() => onDayClick(key)}
              className="py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted/30 border-r last:border-r-0"
            >
              {WEEKDAYS_PT[i]}{' '}
              <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full ml-1', isToday && 'bg-primary text-primary-foreground')}>
                {d.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {!hasAny ? (
        <EmptyState icon={CalendarDays} title="Nenhum evento nesta semana" description="Clique em um dia para criar um evento." />
      ) : (
        <div className="grid grid-cols-7 min-h-[320px]">
          {weekDays.map(d => {
            const key = ymd(d)
            const dayEvents = eventsByDay.get(key) || []
            return (
              <div key={key} className="border-r last:border-r-0 p-1.5 space-y-1 align-top">
                {dayEvents.map(event => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => onOpenEvent(event)}
                    className={cn(
                      'w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight',
                      event.status === 'canceled' ? 'bg-muted text-muted-foreground line-through' : 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
                    )}
                    title={event.title}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-[10px] opacity-80 tabular-nums">{eventTimeLabel(event)}</div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
