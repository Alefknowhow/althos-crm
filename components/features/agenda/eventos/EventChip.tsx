'use client'

/** Bloco de evento na timeline (Semana/Dia) ou na faixa "Dia inteiro" —
 *  cor + horário + título, arrastável pra reagendar (mesmo padrão visual de
 *  CalendarTaskChip, que ficou só em Tasks antes desta separação). */

import { cn } from '@/lib/utils'
import { taskColor } from '@/lib/tasks/colors'
import { eventTimeLabel } from './EventsShared'
import type { EventRow } from '@/actions/events'

export default function EventChip({
  event, expanded = false, onOpen, onDragStart, onDragEnd,
}: {
  event: EventRow
  /** true = bloco com altura própria (timeline); false = linha única (dia inteiro). */
  expanded?: boolean
  onOpen: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const canceled = event.status === 'canceled'
  const color = taskColor(event.color)

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e) }}
      onDragEnd={onDragEnd}
      onClick={e => { e.stopPropagation(); onOpen() }}
      role="button"
      tabIndex={0}
      aria-label={[event.title, event.location].filter(Boolean).join(' — ')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      title={[event.title, event.location].filter(Boolean).join(' · ')}
      className={cn(
        'relative flex flex-col text-[11px] leading-tight px-1.5 py-1 rounded-md cursor-grab active:cursor-grabbing min-w-0 max-w-full overflow-hidden',
        color.className,
        canceled && 'opacity-50 line-through',
        expanded && 'h-full',
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium">
        {!event.all_day && <span className="opacity-80 mr-1 tabular-nums">{eventTimeLabel(event).split(' – ')[0]}</span>}
        {event.title}
      </span>
      {expanded && event.location && (
        <p className="mt-0.5 truncate opacity-90">{event.location}</p>
      )}
    </div>
  )
}
