'use client'

/**
 * TasksBoard — dois modos de topo (viewMode: Lista/Calendário, botão fixo
 * na mesma posição do toolbar em ambos), e dentro do modo Calendário, duas
 * disposições (calView: Mês/Semana):
 *  - Lista: grupos por status (Atrasadas/Hoje/Próximas/Concluídas), sem
 *    calendário nenhum ao lado (TasksBoardListPanel.tsx).
 *  - Calendário › Mês: grade mensal em tela cheia com chips de tarefa
 *    (TasksBoardMonthGrid.tsx).
 *  - Calendário › Semana: timeline por hora em tela cheia
 *    (TasksBoardCalendarPanel.tsx).
 * Todas as leituras usam o mesmo array de tarefas filtrado.
 *
 * Persistência de data/hora segue a mesma âncora UTC do resto do módulo
 * (dueDateOnly/fmtDate tratam devido_date como UTC pra nunca "pular" de dia
 * por causa do fuso do navegador) — ver combineDueDate/dueTimeOnly.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaskDialog from '@/components/features/TaskDialog'
import {
  type Member, type Task, type PriorityFilter, type AssigneeFilter, type GroupId,
  type StatusFilter, type RelatedFilter, type CalView, type ViewMode, type ListPeriod,
  EXPANDED_STORAGE_KEY, DEFAULT_EXPANDED,
  dueDateOnly, startOfMonth, addMonths, startOfWeek, addWeeks, ymd,
} from './TasksBoardShared'
import { EditSheet } from './TasksBoardTaskViews'
import { TasksBoardToolbar } from './TasksBoardToolbar'
import { TasksBoardBody } from './TasksBoardBody'
import { useTasksBoardMutations } from './useTasksBoardMutations'
import { useTasksBoardDerived, useTasksBoardGrid } from './useTasksBoardDerived'
import { TasksBoardQuickCreatePopover, type QuickAddSelection } from './TasksBoardQuickCreatePopover'

export default function TasksBoard({
  initialTasks,
  orgSlug,
  members = [],
  currentUserId,
  niche,
}: {
  initialTasks: Task[]
  orgSlug: string
  members?: Member[]
  /** Usuário logado — habilita o chip rápido "Minhas". */
  currentUserId?: string
  /** Nicho da org — filtra as opções do filtro/tipo "Relacionado a". */
  niche?: string | null
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [assignee, setAssignee] = useState<AssigneeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [relatedFilter, setRelatedFilter] = useState<RelatedFilter>('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>(DEFAULT_EXPANDED)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [listPeriod, setListPeriod] = useState<ListPeriod>('today')
  const [calView, setCalView] = useState<CalView>('month')
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()))
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [todayOnly, setTodayOnly] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<{ date: string; time?: string } | null>(null)
  const [weekQuickAdd, setWeekQuickAdd] = useState<QuickAddSelection | null>(null)

  const {
    dragOverKey, setDragOverKey,
    handleToggleDone, handleSetPriority, handleDelete,
    onChipDragStart, onChipDragEnd,
    handleDropOnSlot, handleDropOnAllDay,
  } = useTasksBoardMutations({ orgSlug, tasks, setTasks, setEditing, setOpenPopoverId })

  useEffect(() => { setTasks(initialTasks) }, [initialTasks])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY)
      if (raw) setExpanded({ ...DEFAULT_EXPANDED, ...JSON.parse(raw) })
    } catch { /* sessionStorage indisponível */ }
  }, [])
  function toggleGroup(id: GroupId) {
    setExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  const { tasksByDate, overdueCount, todayCount, grouped } = useTasksBoardDerived({
    tasks, priority, assignee, statusFilter, relatedFilter, onlyMine, currentUserId, search,
    viewMode, listPeriod, selectedDay, todayOnly, calView, calMonth, weekAnchor,
  })

  /** Clicar numa tarefa na lista: navega o calendário pro período dela,
   *  destaca e abre o drawer de edição completo. */
  function openFromList(task: Task) {
    const d = dueDateOnly(task)
    if (d) {
      setCalMonth(startOfMonth(d))
      setWeekAnchor(startOfWeek(d))
    }
    setHighlightId(task.id)
    setEditing(task)
  }

  const { weekDays, hours, monthDays, todayYmd } = useTasksBoardGrid({ weekAnchor, calMonth, tasksByDate })

  return (
    <div className="space-y-4">
      <TasksBoardToolbar
        search={search} setSearch={setSearch}
        currentUserId={currentUserId}
        onlyMine={onlyMine} setOnlyMine={setOnlyMine}
        todayOnly={todayOnly}
        onClickToday={() => {
          setCalMonth(startOfMonth(new Date()))
          setWeekAnchor(startOfWeek(new Date()))
          setSelectedDay(null)
          setTodayOnly(true)
        }}
        onNewTask={() => setQuickAdd({ date: ymd(new Date()) })}
        calView={calView} setCalView={setCalView}
        onNavPrev={() => calView === 'month' ? setCalMonth(m => addMonths(m, -1)) : setWeekAnchor(w => addWeeks(w, -1))}
        onNavNext={() => calView === 'month' ? setCalMonth(m => addMonths(m, 1)) : setWeekAnchor(w => addWeeks(w, 1))}
        calMonth={calMonth}
        weekDays={weekDays}
        members={members}
        assignee={assignee} setAssignee={setAssignee}
        priority={priority} setPriority={setPriority}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        relatedFilter={relatedFilter} setRelatedFilter={setRelatedFilter}
        niche={niche}
        selectedDay={selectedDay} setSelectedDay={setSelectedDay}
        viewMode={viewMode} setViewMode={setViewMode}
        listPeriod={listPeriod} setListPeriod={setListPeriod}
        overdueCount={overdueCount} todayCount={todayCount}
      />

      <TasksBoardBody
        viewMode={viewMode}
        calView={calView}
        orgSlug={orgSlug}
        members={members}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        todayOnly={todayOnly}
        calMonth={calMonth}
        weekAnchor={weekAnchor}
        grouped={grouped}
        expanded={expanded}
        toggleGroup={toggleGroup}
        highlightId={highlightId}
        openFromList={openFromList}
        handleToggleDone={handleToggleDone}
        handleSetPriority={handleSetPriority}
        handleDelete={handleDelete}
        weekDays={weekDays}
        hours={hours}
        todayYmd={todayYmd}
        tasksByDate={tasksByDate}
        openPopoverId={openPopoverId}
        setOpenPopoverId={setOpenPopoverId}
        dragOverKey={dragOverKey}
        setDragOverKey={setDragOverKey}
        onDropAllDay={handleDropOnAllDay}
        onDropSlot={handleDropOnSlot}
        onChipDragStart={onChipDragStart}
        onChipDragEnd={onChipDragEnd}
        onRangeSelected={setWeekQuickAdd}
        onEdit={setEditing}
        monthDays={monthDays}
        onDayClick={d => setQuickAdd({ date: d })}
      />

      <EditSheet
        task={editing}
        orgSlug={orgSlug}
        members={members}
        niche={niche}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setTasks(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t)))
          setEditing(null)
          router.refresh()
        }}
        onDelete={handleDelete}
      />

      {/* Sempre montado (não `quickAdd && <TaskDialog>`) — desmontar o
          componente no mesmo tick em que o Dialog do Radix ainda está
          fechando/restaurando foco corrompia o DOM e derrubava a página
          ("client-side exception") em cliques rápidos como duplo-clique.
          Só o `open` alterna; o Radix cuida da própria transição de saída. */}
      <TaskDialog
        orgSlug={orgSlug}
        members={members}
        niche={niche}
        defaultDate={quickAdd?.date}
        defaultTime={quickAdd?.time}
        open={!!quickAdd}
        onOpenChange={o => !o && setQuickAdd(null)}
        trigger={<span className="hidden" />}
      />

      {/* Criação rápida por arraste na visão Semana — popover leve ancorado
          ao lado do intervalo selecionado, sem overlay (pedido explícito:
          resto da tela continua interativo, fecha ao clicar fora). */}
      {weekQuickAdd && (
        <TasksBoardQuickCreatePopover
          orgSlug={orgSlug}
          selection={weekQuickAdd}
          onClose={() => setWeekQuickAdd(null)}
          onMoreOptions={(day, time) => {
            setWeekQuickAdd(null)
            setQuickAdd({ date: day, time })
          }}
        />
      )}
    </div>
  )
}

