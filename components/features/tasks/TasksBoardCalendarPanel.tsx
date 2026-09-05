'use client'

/**
 * Calendar-body panel (Month/Week view switch + popover wiring) for
 * TasksBoard. Prop-driven, split out of TasksBoard.tsx.
 */

import { type Member, type Task, type CalView } from './TasksBoardShared'
import { MonthGrid, WeekTimeline } from './TasksBoardCalendarViews'
import { TaskPopoverContent } from './TasksBoardTaskViews'

export function TasksBoardCalendarPanel({
  calView, monthDays, calMonth, weekDays, hours, todayYmd, tasksByDate, members,
  highlightId, openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey, selectedDay,
  orgSlug, onDayClick, onDropDay, onDropAllDay, onDropSlot, onChipDragStart, onChipDragEnd,
  onQuickAddDay, onQuickAddSlot, onToggleDone, onSetPriority, onEdit, onDelete,
}: {
  calView: CalView
  monthDays: Date[]
  calMonth: Date
  weekDays: Date[]
  hours: number[]
  todayYmd: string
  tasksByDate: Record<string, Task[]>
  members: Member[]
  highlightId: string | null
  openPopoverId: string | null
  setOpenPopoverId: (id: string | null) => void
  dragOverKey: string | null
  setDragOverKey: (k: string | null) => void
  selectedDay: string | null
  orgSlug: string
  onDayClick: (d: string) => void
  onDropDay: (e: React.DragEvent, dayYmd: string) => void
  onDropAllDay: (e: React.DragEvent, dayYmd: string) => void
  onDropSlot: (e: React.DragEvent, dayYmd: string, hour: number) => void
  onChipDragStart: (e: React.DragEvent, id: string) => void
  onChipDragEnd: () => void
  onQuickAddDay: (d: string) => void
  onQuickAddSlot: (d: string, t?: string) => void
  onToggleDone: (task: Task) => void
  onSetPriority: (task: Task, p: Task['priority']) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="hidden lg:block lg:w-[35%] min-w-0 lg:order-1">
      {calView === 'month' ? (
        <MonthGrid
          days={monthDays}
          calMonth={calMonth}
          todayYmd={todayYmd}
          tasksByDate={tasksByDate}
          members={members}
          highlightId={highlightId}
          openPopoverId={openPopoverId}
          setOpenPopoverId={setOpenPopoverId}
          dragOverKey={dragOverKey}
          setDragOverKey={setDragOverKey}
          selectedDay={selectedDay}
          onDayClick={onDayClick}
          onDropDay={onDropDay}
          onChipDragStart={onChipDragStart}
          onChipDragEnd={onChipDragEnd}
          onQuickAdd={onQuickAddDay}
          renderPopover={(task, close) => (
            <TaskPopoverContent
              task={task} orgSlug={orgSlug} members={members}
              onToggleDone={() => { onToggleDone(task); close() }}
              onSetPriority={p => onSetPriority(task, p)}
              onEdit={() => { onEdit(task); close() }}
              onDelete={() => { onDelete(task.id); close() }}
            />
          )}
        />
      ) : (
        <WeekTimeline
          days={weekDays}
          hours={hours}
          todayYmd={todayYmd}
          tasksByDate={tasksByDate}
          members={members}
          highlightId={highlightId}
          openPopoverId={openPopoverId}
          setOpenPopoverId={setOpenPopoverId}
          dragOverKey={dragOverKey}
          setDragOverKey={setDragOverKey}
          onDropAllDay={onDropAllDay}
          onDropSlot={onDropSlot}
          onChipDragStart={onChipDragStart}
          onChipDragEnd={onChipDragEnd}
          onQuickAdd={onQuickAddSlot}
          renderPopover={(task, close) => (
            <TaskPopoverContent
              task={task} orgSlug={orgSlug} members={members}
              onToggleDone={() => { onToggleDone(task); close() }}
              onSetPriority={p => onSetPriority(task, p)}
              onEdit={() => { onEdit(task); close() }}
              onDelete={() => { onDelete(task.id); close() }}
            />
          )}
        />
      )}
    </div>
  )
}
