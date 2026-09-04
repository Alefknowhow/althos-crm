'use client'

/**
 * Calendar-view sub-components for TasksBoard (month grid, week timeline,
 * and the small chips/dots that render a task inside a day cell). All
 * prop-driven -- none of these read TasksBoard's local state directly.
 * Split out of TasksBoard.tsx.
 */

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { WEEKDAYS_PT, PRIORITY_META, ymd, isOverdue, stateDotClass, dueTimeOnly, type Task, type Member } from './TasksBoardShared'

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

// ── Calendário — visão Mês ──────────────────────────────────────────────────

export function MonthGrid({
  days, calMonth, todayYmd, tasksByDate, members, highlightId,
  openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey,
  selectedDay, onDayClick, onDropDay, onChipDragStart, onChipDragEnd, onQuickAdd, renderPopover,
}: {
  days: Date[]
  calMonth: Date
  todayYmd: string
  tasksByDate: Record<string, Task[]>
  members: Member[]
  highlightId: string | null
  openPopoverId: string | null
  setOpenPopoverId: (id: string | null) => void
  dragOverKey: string | null
  setDragOverKey: (k: string | null) => void
  selectedDay: string | null
  onDayClick: (d: string) => void
  onDropDay: (e: React.DragEvent, dayYmd: string) => void
  onChipDragStart: (e: React.DragEvent, id: string) => void
  onChipDragEnd: () => void
  onQuickAdd: (d: string) => void
  renderPopover: (task: Task, close: () => void) => React.ReactNode
}) {
  return (
    <div className="rounded-[8px] border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS_PT.map(w => (
          <div key={w} className="py-2 text-center text-[11px] font-medium text-muted-foreground">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = ymd(d)
          const dayTasks = tasksByDate[key] || []
          const inMonth = d.getMonth() === calMonth.getMonth()
          const isToday = key === todayYmd
          const isSelected = selectedDay === key
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const dots = dayTasks.slice(0, 3)
          const overflow = dayTasks.length - dots.length
          const isDragOver = dragOverKey === `month:${key}`
          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              onDoubleClick={() => onQuickAdd(key)}
              onDragOver={e => { e.preventDefault(); setDragOverKey(`month:${key}`) }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={e => onDropDay(e, key)}
              title="Clique para ver as tarefas do dia · duplo clique para criar uma nova"
              className={cn(
                'min-h-[96px] sm:min-h-[108px] min-w-0 border-b border-r p-1.5 text-left align-top transition-colors cursor-pointer',
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= 35 && 'border-b-0',
                !inMonth && 'bg-muted/20',
                isWeekend && inMonth && 'bg-muted/10',
                isToday && 'bg-sky-50 dark:bg-sky-950/25',
                isSelected && 'ring-2 ring-inset ring-primary',
                isDragOver && 'bg-primary/5 ring-2 ring-inset ring-primary/50',
                !isDragOver && 'hover:bg-muted/30',
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] mb-1',
                  isToday ? 'bg-primary text-primary-foreground font-semibold'
                    : inMonth ? 'text-muted-foreground' : 'text-muted-foreground/40',
                )}
              >
                {d.getDate()}
              </span>
              {dayTasks.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                  {dots.map(t => (
                    <CalendarTaskDot
                      key={t.id}
                      task={t}
                      members={members}
                      highlighted={highlightId === t.id}
                      open={openPopoverId === t.id}
                      onOpenChange={o => setOpenPopoverId(o ? t.id : null)}
                      onDragStart={e => onChipDragStart(e, t.id)}
                      onDragEnd={onChipDragEnd}
                      renderPopover={close => renderPopover(t, close)}
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[10px] text-muted-foreground leading-none">+{overflow}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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

/** Indicador compacto (bolinha) usado na grade do mês — sem título, pra não
 *  truncar texto na célula. Clique abre o mesmo popover completo da tarefa;
 *  a lista ao lado é quem mostra o conteúdo (título, contexto, data). */
export function CalendarTaskDot({
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
  const member = members.find(m => m.user_id === task.assigned_to)
  const time = dueTimeOnly(task.due_date)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span
          draggable
          onDragStart={e => { e.stopPropagation(); onDragStart(e) }}
          onDragEnd={onDragEnd}
          onClick={e => e.stopPropagation()}
          title={[task.title, time, member?.name].filter(Boolean).join(' · ')}
          className={cn(
            'inline-block w-2 h-2 rounded-full cursor-grab active:cursor-grabbing shrink-0',
            stateDotClass(task),
            highlighted && 'ring-2 ring-primary/50',
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" onClick={e => e.stopPropagation()}>
        {renderPopover(() => onOpenChange(false))}
      </PopoverContent>
    </Popover>
  )
}

// ── Popover de tarefa (clique no calendário) ─────────────────────────────────

