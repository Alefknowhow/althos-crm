'use client'

/**
 * Corpo do TasksBoard — os três modos de exibição (Lista / Calendário-Semana
 * / Calendário-Mês). Extraído de TasksBoard.tsx só pra manter o arquivo
 * principal dentro do limite de linhas do lint; sem lógica própria, só
 * repassa props.
 */

import {
  type Member, type Task, type GroupId, type CalView, type ViewMode,
} from './TasksBoardShared'
import { TasksBoardListPanel } from './TasksBoardListPanel'
import { TasksBoardCalendarPanel } from './TasksBoardCalendarPanel'
import { TasksBoardMonthGrid } from './TasksBoardMonthGrid'
import { type QuickAddSelection } from './TasksBoardQuickCreatePopover'

export function TasksBoardBody({
  viewMode, calView, orgSlug, members,
  selectedDay, setSelectedDay, todayOnly, calMonth, weekAnchor,
  grouped, expanded, toggleGroup, highlightId, openFromList,
  handleToggleDone, handleSetPriority, handleDelete,
  weekDays, hours, todayYmd, tasksByDate,
  openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey,
  onDropAllDay, onDropSlot, onChipDragStart, onChipDragEnd,
  onRangeSelected, onEdit, monthDays, onDayClick,
}: {
  viewMode: ViewMode
  calView: CalView
  orgSlug: string
  members: Member[]
  selectedDay: string | null
  setSelectedDay: (v: string | null) => void
  todayOnly: boolean
  calMonth: Date
  weekAnchor: Date
  grouped: Record<GroupId, Task[]>
  expanded: Record<GroupId, boolean>
  toggleGroup: (id: GroupId) => void
  highlightId: string | null
  openFromList: (task: Task) => void
  handleToggleDone: (task: Task) => void
  handleSetPriority: (task: Task, p: Task['priority']) => void
  handleDelete: (id: string) => void
  weekDays: Date[]
  hours: number[]
  todayYmd: string
  tasksByDate: Record<string, Task[]>
  openPopoverId: string | null
  setOpenPopoverId: (id: string | null) => void
  dragOverKey: string | null
  setDragOverKey: (k: string | null) => void
  onDropAllDay: (e: React.DragEvent, dayYmd: string) => void
  onDropSlot: (e: React.DragEvent, dayYmd: string, hour: number) => void
  onChipDragStart: (e: React.DragEvent, taskId: string) => void
  onChipDragEnd: () => void
  onRangeSelected: (selection: QuickAddSelection) => void
  onEdit: (t: Task | null) => void
  monthDays: Date[]
  onDayClick: (d: string) => void
}) {
  const listPanel = (
    <TasksBoardListPanel
      orgSlug={orgSlug}
      members={members}
      selectedDay={selectedDay}
      setSelectedDay={setSelectedDay}
      todayOnly={todayOnly}
      calView={calView}
      calMonth={calMonth}
      weekAnchor={weekAnchor}
      grouped={grouped}
      expanded={expanded}
      toggleGroup={toggleGroup}
      highlightId={highlightId}
      onOpenFromList={openFromList}
      onToggleDone={handleToggleDone}
      onSetPriority={handleSetPriority}
      onDelete={handleDelete}
    />
  )

  if (viewMode === 'list') {
    // Modo Lista — grupos por status (Atrasadas/Hoje/Próximas/Concluídas),
    // sem calendário nenhum ao lado (anexo 2 do pedido).
    return listPanel
  }

  // Modo Calendário — grade mensal em tela cheia (anexo 1) ou timeline
  // semanal por hora. Nunca aparece abaixo de lg (pedido explícito, mesmo
  // padrão de antes do redesign) — mobile cai pra lista mesmo com o modo
  // Calendário selecionado (ex.: estado persistido).
  if (calView === 'week') {
    return (
      <>
        <div className="hidden lg:block">
          <TasksBoardCalendarPanel
            weekDays={weekDays}
            hours={hours}
            todayYmd={todayYmd}
            tasksByDate={tasksByDate}
            members={members}
            highlightId={highlightId}
            openPopoverId={openPopoverId}
            setOpenPopoverId={setOpenPopoverId}
            dragOverKey={dragOverKey}
            setDragOverKey={setDragOverKey}
            orgSlug={orgSlug}
            onDropAllDay={onDropAllDay}
            onDropSlot={onDropSlot}
            onChipDragStart={onChipDragStart}
            onChipDragEnd={onChipDragEnd}
            onRangeSelected={onRangeSelected}
            onToggleDone={handleToggleDone}
            onSetPriority={handleSetPriority}
            onEdit={onEdit}
            onDelete={handleDelete}
          />
        </div>
        <div className="lg:hidden">{listPanel}</div>
      </>
    )
  }

  return (
    <>
      <div className="hidden lg:block" style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>
        <TasksBoardMonthGrid
          days={monthDays}
          calMonth={calMonth}
          todayYmd={todayYmd}
          tasksByDate={tasksByDate}
          onDayClick={onDayClick}
          onOpenTask={openFromList}
        />
      </div>
      <div className="lg:hidden">{listPanel}</div>
    </>
  )
}
