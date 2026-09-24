'use client'

/** Grade mensal do Calendário da Agenda — mesmo padrão visual de
 *  TasksBoardMonthGrid.tsx (chip com bolinha + horário + título por dia),
 *  trocando a fonte de dados de tasks (due_date) por events (start_at/end_at). */

import { cn } from '@/lib/utils'
import { WEEKDAYS_PT, ymd } from '@/components/features/tasks/TasksBoardShared'
import { eventTimeLabel } from './CalendarShared'
import type { EventRow } from '@/actions/events'

const MAX_CHIPS_PER_DAY = 3

function chipClass(e: EventRow): string {
  if (e.status === 'canceled') return 'bg-muted text-muted-foreground line-through'
  return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
}

export default function CalendarMonthGrid({
  days, calMonth, todayYmd, eventsByDay, onDayClick, onOpenEvent,
}: {
  days: Date[]
  calMonth: Date
  todayYmd: string
  eventsByDay: Map<string, EventRow[]>
  onDayClick: (d: string) => void
  onOpenEvent: (event: EventRow) => void
}) {
  return (
    <div className="rounded-[8px] border bg-card overflow-hidden flex flex-col h-full">
      <div className="grid grid-cols-7 border-b shrink-0">
        {WEEKDAYS_PT.map(w => (
          <div key={w} className="py-2 text-center text-xs font-medium text-muted-foreground">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }}>
        {days.map(d => {
          const key = ymd(d)
          const inMonth = d.getMonth() === calMonth.getMonth()
          const isToday = key === todayYmd
          const dayEvents = eventsByDay.get(key) || []
          const overflow = dayEvents.length - MAX_CHIPS_PER_DAY

          return (
            <button
              type="button"
              key={key}
              onClick={() => onDayClick(key)}
              className={cn(
                'group flex flex-col items-stretch gap-1 border-b border-r p-1.5 text-left align-top min-h-[92px] transition-colors',
                'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                !inMonth && 'bg-muted/20',
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0',
                  !inMonth && 'text-muted-foreground/40',
                  inMonth && !isToday && 'text-foreground',
                  isToday && 'bg-primary text-primary-foreground font-semibold',
                )}
              >
                {d.getDate()}
              </span>

              <div className="flex flex-col gap-0.5 min-w-0">
                {dayEvents.slice(0, MAX_CHIPS_PER_DAY).map(event => (
                  <span
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={e => { e.stopPropagation(); onOpenEvent(event) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenEvent(event) } }}
                    className={cn('flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer', chipClass(event))}
                    title={event.title}
                  >
                    {!event.all_day && <span className="tabular-nums shrink-0">{eventTimeLabel(event).split(' – ')[0]}</span>}
                    <span className="truncate">{event.title}</span>
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground pl-1">+{overflow} mais</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
