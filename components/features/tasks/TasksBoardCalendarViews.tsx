'use client'

/**
 * Calendar-view sub-components for TasksBoard: filter chips, the week-range
 * label, and CalendarTaskChip (the task row used inside the week timeline —
 * see TasksBoardWeekView.tsx). The month grid has no task info anymore (see
 * TasksBoardMiniCalendar.tsx, a bare date picker). All prop-driven -- none
 * of these read TasksBoard's local state directly. Split out of
 * TasksBoard.tsx.
 */

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { taskColor } from '@/lib/tasks/colors'
import { stateDotClass, dueTimeOnly, type Task, type Member } from './TasksBoardShared'

export { WeekTimeline } from './TasksBoardWeekView'

export function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 font-normal">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover filtro: ${label}`}
        className="rounded-full hover:bg-muted-foreground/20 p-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </Badge>
  )
}

export function weekRangeLabel(days: Date[]) {
  const start = days[0]
  const end = days[6]
  const sameMonth = start.getMonth() === end.getMonth()
  const fmt = (d: Date, withMonth: boolean) =>
    withMonth ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : d.toLocaleDateString('pt-BR', { day: '2-digit' })
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`
}

/** Bloco da timeline; duração controla a altura e o clique abre os detalhes. */
export function CalendarTaskChip({
  task, members, expanded = false, highlighted, open, onOpenChange, onDragStart, onDragEnd, renderPopover,
}: {
  task: Task
  expanded?: boolean
  members: Member[]
  highlighted: boolean
  open: boolean
  onOpenChange: (o: boolean) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  renderPopover: (close: () => void) => React.ReactNode
}) {
  const done = task.status === 'done'
  const member = members.find(m => m.user_id === task.assigned_to)
  const time = dueTimeOnly(task.due_date)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div
          draggable
          onDragStart={e => { e.stopPropagation(); onDragStart(e) }}
          onDragEnd={onDragEnd}
          onClick={e => e.stopPropagation()}
          role="button"
          tabIndex={0}
          aria-label={[task.title, task.description].filter(Boolean).join(' — ')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChange(!open) } }}
          title={[task.title, task.description, member?.name].filter(Boolean).join(' · ')}
          className={cn(
            'relative flex flex-col text-[11px] leading-tight px-1.5 py-1 rounded-md cursor-grab active:cursor-grabbing min-w-0 max-w-full overflow-hidden',
            taskColor(task.color).className,
            expanded && 'h-full',
            highlighted && 'ring-2 ring-foreground ring-offset-1',
          )}
        >
          <div className="flex items-center gap-1 min-w-0 shrink-0">
            <span className={cn('w-2 h-2 rounded-[3px] ring-1 ring-white/70 shrink-0', stateDotClass(task))} />
            <span className={cn('min-w-0 flex-1 truncate font-medium', done && 'line-through')}>
              {time && <span className="opacity-80 mr-1 tabular-nums">{time}</span>}
              {task.title}
            </span>
          </div>
          {task.description?.trim() && (
            <p className={cn('mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]', expanded ? 'min-h-0 overflow-y-auto' : 'line-clamp-2')}>
              {task.description}
            </p>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" onClick={e => e.stopPropagation()}>
        {renderPopover(() => onOpenChange(false))}
      </PopoverContent>
    </Popover>
  )
}

