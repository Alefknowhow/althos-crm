'use client'

/**
 * Semana em tela cheia — ocupa toda a largura do corpo do painel (a visão
 * Mês usa o mini calendário + lista lado a lado, montados direto em
 * TasksBoard.tsx; só a Semana precisa desse espaço todo pra timeline por
 * hora não ficar espremida).
 */

import { type Member, type Task } from './TasksBoardShared'
import { WeekTimeline } from './TasksBoardCalendarViews'
import { TaskPopoverContent } from './TasksBoardTaskViews'

export function TasksBoardCalendarPanel({
  weekDays, hours, todayYmd, tasksByDate, members,
  highlightId, openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey,
  orgSlug, onDropAllDay, onDropSlot, onChipDragStart, onChipDragEnd,
  onQuickAddSlot, onToggleDone, onSetPriority, onEdit, onDelete,
}: {
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
  orgSlug: string
  onDropAllDay: (e: React.DragEvent, dayYmd: string) => void
  onDropSlot: (e: React.DragEvent, dayYmd: string, hour: number) => void
  onChipDragStart: (e: React.DragEvent, id: string) => void
  onChipDragEnd: () => void
  onQuickAddSlot: (d: string, t?: string) => void
  onToggleDone: (task: Task) => void
  onSetPriority: (task: Task, p: Task['priority']) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="w-full">
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
    </div>
  )
}
