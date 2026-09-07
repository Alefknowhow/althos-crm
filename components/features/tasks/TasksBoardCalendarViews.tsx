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
import { PRIORITY_META, isOverdue, stateDotClass, dueTimeOnly, type Task, type Member } from './TasksBoardShared'

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

/** Linha compacta de tarefa dentro da célula do mês — texto, não badge.
 *  Hover mostra um preview leve; clique abre o popover completo. */
export function CalendarTaskChip({
  task, members, highlighted, open, onOpenChange, onDragStart, onDragEnd, renderPopover,
}: {
  task: Task
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
          title={member ? `${task.title} · ${member.name}` : task.title}
          className={cn(
            'group/chip relative flex items-center gap-1 text-[11px] leading-tight px-1 py-0.5 rounded cursor-grab active:cursor-grabbing min-w-0 max-w-full overflow-hidden',
            'hover:bg-muted/60',
            highlighted && 'ring-1 ring-primary/50 bg-primary/5',
          )}
        >
          <span className={cn('w-2 h-2 rounded-[3px] shrink-0', stateDotClass(task))} />
          <span className={cn('min-w-0 flex-1 truncate [overflow-wrap:anywhere]', done && 'line-through text-muted-foreground')}>
            {time && <span className="text-muted-foreground/70 mr-1 tabular-nums">{time}</span>}
            {task.title}
          </span>

          {/* Hover preview — sem precisar clicar */}
          <div className="hidden group-hover/chip:block absolute left-0 top-full z-20 mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow-md p-2.5 space-y-1">
            <p className="text-xs font-semibold leading-tight">{task.title}</p>
            {time && <p className="text-[11px] text-muted-foreground">{time}</p>}
            {member && <p className="text-[11px] text-muted-foreground">{member.name}</p>}
            <p className="text-[11px] text-muted-foreground">Prioridade: {PRIORITY_META[task.priority].label}</p>
            <p className="text-[11px] text-muted-foreground">Status: {done ? 'Concluída' : isOverdue(task) ? 'Atrasada' : 'Pendente'}</p>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" onClick={e => e.stopPropagation()}>
        {renderPopover(() => onOpenChange(false))}
      </PopoverContent>
    </Popover>
  )
}

