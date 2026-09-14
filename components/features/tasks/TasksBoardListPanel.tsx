'use client'

/**
 * Grouped task-list panel (header + collapsible groups) for TasksBoard.
 * Prop-driven, split out of TasksBoard.tsx.
 */

import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  type Member, type Task, type GroupId, GROUPS, FOCUS_RING, addDays, startOfWeek,
} from './TasksBoardShared'
import { weekRangeLabel } from './TasksBoardCalendarViews'
import { TaskListRow } from './TasksBoardTaskViews'

export function TasksBoardListPanel({
  orgSlug, members, selectedDay, setSelectedDay, todayOnly, calView, calMonth, weekAnchor,
  grouped, expanded, toggleGroup, highlightId, onOpenFromList, onToggleDone, onSetPriority, onDelete,
}: {
  orgSlug: string
  members: Member[]
  selectedDay: string | null
  setSelectedDay: (v: string | null) => void
  todayOnly: boolean
  calView: 'month' | 'week'
  calMonth: Date
  weekAnchor: Date
  grouped: Record<GroupId, Task[]>
  expanded: Record<GroupId, boolean>
  toggleGroup: (id: GroupId) => void
  highlightId: string | null
  onOpenFromList: (task: Task) => void
  onToggleDone: (task: Task) => void
  onSetPriority: (task: Task, p: Task['priority']) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="w-full lg:w-[65%] min-w-0 space-y-2 lg:order-2">
      <div className="px-0.5 flex items-center gap-2">
        <span className="text-sm font-semibold">
          {selectedDay
            ? new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long' }).toUpperCase()
            : todayOnly
              ? 'Tarefas de hoje'
              : calView === 'month'
                ? `Tarefas de ${calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
                : `Tarefas de ${weekRangeLabel(Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(weekAnchor), i)))}`}
        </span>
        {selectedDay && (
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className="text-xs text-primary hover:underline"
          >
            Voltar para Hoje
          </button>
        )}
      </div>

      {/* Cada grupo é seu próprio cartão, com respiro entre um e outro —
          antes ficavam todos colados num container só, só separados por
          uma linha fina (pedido explícito de "desgrudar"). */}
      <div className="space-y-2.5">
        {GROUPS.map(g => {
          const list = grouped[g.id]
          const isOpen = expanded[g.id]
          const danger = g.id === 'overdue'
          return (
            <div key={g.id} className="rounded-[8px] border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3.5 h-11 text-left transition-colors duration-150 bg-muted/30 hover:bg-muted/50',
                  FOCUS_RING,
                )}
              >
                {isOpen
                  ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                <span className={cn('text-[13px] font-semibold', danger && list.length > 0 && 'text-destructive')}>
                  {g.label}
                </span>
                <span className={cn('ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums', g.badge)}>
                  {list.length}
                </span>
              </button>

              {isOpen && (
                list.length === 0 ? (
                  <div className="px-3.5 py-3 text-xs text-muted-foreground border-t">{g.empty}</div>
                ) : (
                  <div className="divide-y border-t">
                    {list.map(task => (
                      <TaskListRow
                        key={task.id}
                        task={task}
                        orgSlug={orgSlug}
                        members={members}
                        highlighted={highlightId === task.id}
                        onOpen={() => onOpenFromList(task)}
                        onToggleDone={() => onToggleDone(task)}
                        onSetPriority={p => onSetPriority(task, p)}
                        onDelete={() => onDelete(task.id)}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
