'use client'

/**
 * TasksBoard — Calendário (60%) + Lista agrupada (40%), lado a lado no
 * desktop, sincronizados (mesmo array de tarefas filtrado alimenta os dois).
 * Substitui a versão anterior (só lista em 3 grupos) por pedido explícito do
 * usuário de trazer de volta um calendário operacional, inspirado no Google
 * Agenda mas usando só os tokens/componentes já existentes no Althos.
 *
 * Persistência de data/hora segue a mesma âncora UTC do resto do módulo
 * (dueDateOnly/fmtDate tratam devido_date como UTC pra nunca "pular" de dia
 * por causa do fuso do navegador) — ver combineDueDate/dueTimeOnly.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaskDialog from '@/components/features/TaskDialog'
import {
  type Member, type Task, type PriorityFilter, type AssigneeFilter, type GroupId,
  type StatusFilter, type RelatedFilter, type CalView,
  EXPANDED_STORAGE_KEY, DEFAULT_EXPANDED,
  todayISO, dueDateOnly, dueTimeOnly, classify, completedAtMs,
  startOfMonth, addMonths, startOfWeek, addDays, addWeeks, ymd,
} from './TasksBoardShared'
import { EditSheet } from './TasksBoardTaskViews'
import { TasksBoardToolbar } from './TasksBoardToolbar'
import { TasksBoardListPanel } from './TasksBoardListPanel'
import { TasksBoardCalendarPanel } from './TasksBoardCalendarPanel'
import { useTasksBoardMutations } from './useTasksBoardMutations'

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

  const [calView, setCalView] = useState<CalView>('month')
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()))
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [todayOnly, setTodayOnly] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<{ date: string; time?: string } | null>(null)

  const {
    dragOverKey, setDragOverKey,
    handleToggleDone, handleSetPriority, handleDelete,
    onChipDragStart, onChipDragEnd,
    handleDropOnDay, handleDropOnSlot, handleDropOnAllDay,
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

  // ── Filtros (afetam calendário E lista, ao mesmo tempo) ────────────────────
  function matchesAssignee(t: Task, f: AssigneeFilter): boolean {
    if (f === 'all') return true
    if (f === 'none') return !t.assigned_to
    return t.assigned_to === f
  }
  function matchesSearch(t: Task, q: string): boolean {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return t.title.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle)
  }

  function matchesRelated(t: Task, f: RelatedFilter): boolean {
    if (f === 'all') return true
    return (t.related?.type ?? null) === f
  }

  const filtered = useMemo(
    () => tasks.filter(t =>
      (priority === 'all' || t.priority === priority) &&
      matchesAssignee(t, assignee) &&
      (statusFilter === 'all' || classify(t) === statusFilter) &&
      matchesRelated(t, relatedFilter) &&
      (!onlyMine || t.assigned_to === currentUserId) &&
      matchesSearch(t, search),
    ),
    [tasks, priority, assignee, statusFilter, relatedFilter, onlyMine, currentUserId, search],
  )

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of filtered) {
      const d = dueDateOnly(t)
      if (!d) continue
      ;(map[ymd(d)] ??= []).push(t)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (dueTimeOnly(a.due_date) || '').localeCompare(dueTimeOnly(b.due_date) || ''))
    }
    return map
  }, [filtered])

  // A lista segue o período visível no calendário — mês inteiro (visão Mês)
  // ou semana inteira (visão Semana). Não existe mais filtro de um dia
  // avulso: o único recorte diário é o toggle "Hoje" (mais abaixo). Tarefas
  // sem data ficam sempre visíveis (não têm período pra pertencer).
  const periodTasks = useMemo(() => {
    if (selectedDay) {
      return filtered.filter(t => t.due_date && t.due_date.split('T')[0] === selectedDay)
    }
    if (todayOnly) {
      const t0 = todayISO()
      return filtered.filter(t => t.due_date && t.due_date.split('T')[0] === t0)
    }
    if (calView === 'month') {
      return filtered.filter(t => {
        const d = dueDateOnly(t)
        if (!d) return true
        return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth()
      })
    }
    const weekStart = startOfWeek(weekAnchor)
    const weekEnd = addDays(weekStart, 6)
    return filtered.filter(t => {
      const d = dueDateOnly(t)
      if (!d) return true
      return d >= weekStart && d <= weekEnd
    })
  }, [filtered, selectedDay, todayOnly, calView, calMonth, weekAnchor])

  const grouped = useMemo(() => {
    const byGroup: Record<GroupId, Task[]> = { overdue: [], today: [], upcoming: [], done: [] }
    for (const t of periodTasks) byGroup[classify(t)].push(t)
    // Atrasadas/Hoje/Próximas: due_date ASC, depois horário ASC (undated por
    // último). Concluídas: completed_at DESC (mais recente primeiro).
    const byDateAsc = (a: Task, b: Task) => {
      const da = dueDateOnly(a)?.getTime() ?? Infinity
      const db = dueDateOnly(b)?.getTime() ?? Infinity
      if (da !== db) return da - db
      return (dueTimeOnly(a.due_date) || '').localeCompare(dueTimeOnly(b.due_date) || '')
    }
    byGroup.overdue.sort(byDateAsc)
    byGroup.today.sort((a, b) => (dueTimeOnly(a.due_date) || '').localeCompare(dueTimeOnly(b.due_date) || ''))
    byGroup.upcoming.sort(byDateAsc)
    byGroup.done.sort((a, b) => completedAtMs(b) - completedAtMs(a))
    return byGroup
  }, [periodTasks])

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

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)), [weekAnchor])

  // Faixa de horas da timeline: padrão comercial (7h–20h), expandida se
  // alguma tarefa com horário da semana visível ficar fora desse intervalo.
  const hourRange = useMemo(() => {
    let min = 7, max = 20
    for (const d of weekDays) {
      for (const t of tasksByDate[ymd(d)] || []) {
        const time = dueTimeOnly(t.due_date)
        if (!time) continue
        const h = parseInt(time.split(':')[0], 10)
        if (h < min) min = h
        if (h > max) max = h
      }
    }
    return { start: min, end: max }
  }, [weekDays, tasksByDate])
  const hours = useMemo(
    () => Array.from({ length: hourRange.end - hourRange.start + 1 }, (_, i) => hourRange.start + i),
    [hourRange],
  )

  const monthDays = useMemo(() => {
    const gridStart = startOfWeek(calMonth)
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [calMonth])

  const todayYmd = ymd(new Date())

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
        setTodayOnly={setTodayOnly}
      />

      {/* Corpo: calendário 35% à esquerda + lista 65% à direita */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <TasksBoardCalendarPanel
          calView={calView}
          monthDays={monthDays}
          calMonth={calMonth}
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
          selectedDay={selectedDay}
          orgSlug={orgSlug}
          onDayClick={d => { setSelectedDay(prev => prev === d ? null : d); setTodayOnly(false) }}
          onDropDay={handleDropOnDay}
          onDropAllDay={handleDropOnAllDay}
          onDropSlot={handleDropOnSlot}
          onChipDragStart={onChipDragStart}
          onChipDragEnd={onChipDragEnd}
          onQuickAddDay={d => setQuickAdd({ date: d })}
          onQuickAddSlot={(d, t) => setQuickAdd({ date: d, time: t })}
          onToggleDone={handleToggleDone}
          onSetPriority={handleSetPriority}
          onEdit={setEditing}
          onDelete={handleDelete}
        />

        {/* Lista — 65%, sempre escopada ao período visível no calendário */}
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
      </div>

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
    </div>
  )
}

