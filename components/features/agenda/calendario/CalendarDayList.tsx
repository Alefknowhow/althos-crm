'use client'

/** Visão Dia do Calendário — lista simples dos eventos do dia selecionado,
 *  ordenados por horário (issue #14 §4: "visões mês/semana/dia"). */

import { cn } from '@/lib/utils'
import { eventTimeLabel, EVENT_STATUS_LABEL } from './CalendarShared'
import { EVENT_TYPE_LABEL, type EventType } from '@/lib/validators/event'
import type { EventRow } from '@/actions/events'
import EmptyState from '@/components/ui/empty-state'
import { CalendarDays, MapPin } from 'lucide-react'

export default function CalendarDayList({
  day, events, onOpenEvent,
}: {
  day: Date
  events: EventRow[]
  onOpenEvent: (event: EventRow) => void
}) {
  const label = day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="rounded-[8px] border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b text-sm font-medium capitalize">{label}</div>

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum evento neste dia" description="Use o botão “Novo” para criar um compromisso." />
      ) : (
        <div className="divide-y">
          {events.map(event => (
            <button
              type="button"
              key={event.id}
              onClick={() => onOpenEvent(event)}
              className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-start gap-3"
            >
              <span className="text-xs font-medium tabular-nums text-muted-foreground pt-0.5 w-24 shrink-0">
                {eventTimeLabel(event)}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn('font-medium truncate', event.status === 'canceled' && 'line-through text-muted-foreground')}>
                  {event.title}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  <span>{EVENT_TYPE_LABEL[event.event_type as EventType] || event.event_type}</span>
                  {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                  {event.status === 'canceled' && <span className="text-destructive">{EVENT_STATUS_LABEL.canceled}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
