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
import { Button } from '@/components/ui/button'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { relatedTypeOptions, RELATED_TYPE_LABELS, type RelatedTypeValue } from '@/lib/tasks/related-types'
import TaskDialog from '@/components/features/TaskDialog'
import { updateTask, deleteTask, toggleTaskStatus, setTaskPriority } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  User2, Calendar, Search,
  X, ChevronDown, ChevronRight, ChevronLeft, Plus,
} from 'lucide-react'
import {
  type Member, type Task, type PriorityFilter, type AssigneeFilter, type GroupId,
  type StatusFilter, type RelatedFilter, type CalView,
  GROUPS, STATUS_OPTIONS, ROW_H, PRIORITY_META, FOCUS_RING, EXPANDED_STORAGE_KEY, DEFAULT_EXPANDED,
  todayISO, dueDateOnly, dueTimeOnly, combineDueDate, classify, completedAtMs,
  startOfMonth, addMonths, startOfWeek, addDays, addWeeks, ymd,
} from './TasksBoardShared'
import { FilterChip, weekRangeLabel, MonthGrid, WeekTimeline } from './TasksBoardCalendarViews'
import { TaskPopoverContent, TaskListRow, EditSheet } from './TasksBoardTaskViews'

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
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

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

  // ── Mutations (otimistas, sem reload) ──────────────────────────────────────
  async function handleToggleDone(task: Task) {
    const next = task.status === 'done' ? 'open' : 'done'
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: next } : t)))
    const res = await toggleTaskStatus(orgSlug, task.id, next)
    if (!res.ok) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: task.status } : t)))
      toast.error('Erro ao atualizar tarefa')
      return
    }
    router.refresh()
  }

  async function handleSetPriority(task: Task, p: Task['priority']) {
    if (task.priority === p) return
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, priority: p } : t)))
    const res = await setTaskPriority(orgSlug, task.id, p)
    if (!res.ok) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, priority: task.priority } : t)))
      toast.error('Erro ao atualizar prioridade')
      return
    }
    router.refresh()
  }

  async function handleSetDueDate(task: Task, newDueISO: string | null) {
    const prevDue = task.due_date ?? null
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, due_date: newDueISO } : t)))
    const res = await updateTask(orgSlug, task.id, { due_date: newDueISO || '' })
    if (!res.ok) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, due_date: prevDue } : t)))
      toast.error('Erro ao mover tarefa')
      return
    }
    router.refresh()
  }

  async function handleDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    setEditing(null)
    setOpenPopoverId(null)
    const res = await deleteTask(orgSlug, id)
    if (!res.ok) {
      toast.error('Erro ao excluir tarefa')
      router.refresh()
      return
    }
    toast.success('Tarefa excluída')
    router.refresh()
  }

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

  // ── Drag & drop ──────────────────────────────────────────────────────────
  function onChipDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
    setDragId(taskId)
  }
  function onChipDragEnd() {
    setDragId(null)
    setDragOverKey(null)
  }
  function dropTaskId(e: React.DragEvent): string | null {
    return dragId || e.dataTransfer.getData('text/plain') || null
  }
  /** Mês: solta num dia → troca a data, preserva o horário se já tinha. */
  function handleDropOnDay(e: React.DragEvent, dayYmd: string) {
    e.preventDefault()
    const id = dropTaskId(e)
    setDragId(null); setDragOverKey(null)
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const time = dueTimeOnly(task.due_date)
    handleSetDueDate(task, combineDueDate(dayYmd, time || ''))
  }
  /** Semana: solta num slot de hora → troca data E horário. */
  function handleDropOnSlot(e: React.DragEvent, dayYmd: string, hour: number) {
    e.preventDefault()
    const id = dropTaskId(e)
    setDragId(null); setDragOverKey(null)
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const minute = Math.min(30, Math.max(0, Math.round((offsetY / ROW_H) * 60 / 30) * 30))
    handleSetDueDate(task, combineDueDate(dayYmd, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`))
  }
  /** Semana: solta em "Dia inteiro" → mantém a data, remove o horário. */
  function handleDropOnAllDay(e: React.DragEvent, dayYmd: string) {
    e.preventDefault()
    const id = dropTaskId(e)
    setDragId(null); setDragOverKey(null)
    const task = tasks.find(t => t.id === id)
    if (!task) return
    handleSetDueDate(task, combineDueDate(dayYmd, ''))
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
      {/* Busca + chip "Minhas" + Nova tarefa */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            className={cn(
              'h-8 w-full rounded-md border border-input bg-input/25 pl-8 pr-7 text-xs placeholder:text-muted-foreground',
              FOCUS_RING,
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {currentUserId && (
          <button
            type="button"
            onClick={() => setOnlyMine(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors shrink-0',
              FOCUS_RING,
              onlyMine
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted text-muted-foreground border-border',
            )}
          >
            <User2 className="w-3.5 h-3.5" /> Minhas
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setCalMonth(startOfMonth(new Date()))
            setWeekAnchor(startOfWeek(new Date()))
            setSelectedDay(null)
            setTodayOnly(true)
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-pill border text-xs font-medium transition-colors shrink-0',
            FOCUS_RING,
            todayOnly
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted text-muted-foreground border-border',
          )}
        >
          <Calendar className="w-3.5 h-3.5" /> Hoje
        </button>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setQuickAdd({ date: ymd(new Date()) })} className="gap-1.5">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova tarefa</span>
          </Button>
        </div>
      </div>

      {/* Header do calendário: navegação + Mês/Semana + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => calView === 'month' ? setCalMonth(m => addMonths(m, -1)) : setWeekAnchor(w => addWeeks(w, -1))}
            className={cn('flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors', FOCUS_RING)}
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[150px] text-center capitalize">
            {calView === 'month'
              ? calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              : weekRangeLabel(weekDays)}
          </span>
          <button
            type="button"
            onClick={() => calView === 'month' ? setCalMonth(m => addMonths(m, 1)) : setWeekAnchor(w => addWeeks(w, 1))}
            className={cn('flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors', FOCUS_RING)}
            aria-label="Próximo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          {(['month', 'week'] as CalView[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setCalView(v)}
              className={cn(
                'px-3 h-7 rounded-md text-xs font-medium transition-colors',
                FOCUS_RING,
                calView === v ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'month' ? 'Mês' : 'Semana'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {members.length > 0 && (
            <ResponsiveSelect
              className="h-8 w-[170px] text-xs"
              aria-label="Filtrar por responsável"
              value={assignee}
              onValueChange={v => setAssignee(v as AssigneeFilter)}
              options={[
                { value: 'all', label: 'Responsável: Todos' },
                { value: 'none', label: 'Responsável: Sem responsável' },
                ...members.map(m => ({ value: m.user_id, label: `Responsável: ${m.name}` })),
              ]}
            />
          )}
          <ResponsiveSelect
            className="h-8 w-[150px] text-xs"
            aria-label="Filtrar por prioridade"
            value={priority}
            onValueChange={v => setPriority(v as PriorityFilter)}
            options={[
              { value: 'all', label: 'Prioridade: Todas' },
              { value: 'high', label: `Prioridade: ${PRIORITY_META.high.label}` },
              { value: 'normal', label: `Prioridade: ${PRIORITY_META.normal.label}` },
              { value: 'low', label: `Prioridade: ${PRIORITY_META.low.label}` },
            ]}
          />
          <ResponsiveSelect
            className="h-8 w-[150px] text-xs"
            aria-label="Filtrar por status"
            value={statusFilter}
            onValueChange={v => setStatusFilter(v as StatusFilter)}
            options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.value === 'all' ? 'Status: Todos' : `Status: ${o.label}` }))}
          />
          <ResponsiveSelect
            className="h-8 w-[180px] text-xs"
            aria-label="Filtrar por relacionado a"
            value={relatedFilter}
            onValueChange={v => setRelatedFilter(v as RelatedFilter)}
            options={[
              { value: 'all', label: 'Relacionado a: Todos' },
              ...relatedTypeOptions(niche).map(o => ({ value: o.value, label: `Relacionado a: ${o.label}` })),
            ]}
          />
        </div>
      </div>

      {/* Chips de filtros ativos — cada × zera só aquele filtro */}
      {(priority !== 'all' || assignee !== 'all' || statusFilter !== 'all' || relatedFilter !== 'all' || onlyMine || todayOnly || selectedDay) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedDay && (
            <FilterChip label={`Dia: ${new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })}`} onClear={() => setSelectedDay(null)} />
          )}
          {todayOnly && <FilterChip label="Hoje" onClear={() => setTodayOnly(false)} />}
          {onlyMine && <FilterChip label="Minhas" onClear={() => setOnlyMine(false)} />}
          {priority !== 'all' && <FilterChip label={`Prioridade: ${PRIORITY_META[priority].label}`} onClear={() => setPriority('all')} />}
          {assignee !== 'all' && (
            <FilterChip
              label={`Responsável: ${assignee === 'none' ? 'Sem responsável' : (members.find(m => m.user_id === assignee)?.name ?? '—')}`}
              onClear={() => setAssignee('all')}
            />
          )}
          {statusFilter !== 'all' && <FilterChip label={`Status: ${GROUPS.find(g => g.id === statusFilter)?.label ?? statusFilter}`} onClear={() => setStatusFilter('all')} />}
          {relatedFilter !== 'all' && (
            <FilterChip
              label={`Relacionado a: ${RELATED_TYPE_LABELS[relatedFilter as RelatedTypeValue] ?? relatedFilter}`}
              onClear={() => setRelatedFilter('all')}
            />
          )}
        </div>
      )}

      {/* Corpo: calendário 35% à esquerda + lista 65% à direita */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
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
              onDayClick={d => { setSelectedDay(prev => prev === d ? null : d); setTodayOnly(false) }}
              onDropDay={handleDropOnDay}
              onChipDragStart={onChipDragStart}
              onChipDragEnd={onChipDragEnd}
              onQuickAdd={d => setQuickAdd({ date: d })}
              renderPopover={(task, close) => (
                <TaskPopoverContent
                  task={task} orgSlug={orgSlug} members={members}
                  onToggleDone={() => { handleToggleDone(task); close() }}
                  onSetPriority={p => handleSetPriority(task, p)}
                  onEdit={() => { setEditing(task); close() }}
                  onDelete={() => { handleDelete(task.id); close() }}
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
              onDropAllDay={handleDropOnAllDay}
              onDropSlot={handleDropOnSlot}
              onChipDragStart={onChipDragStart}
              onChipDragEnd={onChipDragEnd}
              onQuickAdd={(d, t) => setQuickAdd({ date: d, time: t })}
              renderPopover={(task, close) => (
                <TaskPopoverContent
                  task={task} orgSlug={orgSlug} members={members}
                  onToggleDone={() => { handleToggleDone(task); close() }}
                  onSetPriority={p => handleSetPriority(task, p)}
                  onEdit={() => { setEditing(task); close() }}
                  onDelete={() => { handleDelete(task.id); close() }}
                />
              )}
            />
          )}
        </div>

        {/* Lista — 65%, sempre escopada ao período visível no calendário */}
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

          <div className="rounded-[8px] border bg-card overflow-hidden divide-y">
              {GROUPS.map(g => {
                const list = grouped[g.id]
                const isOpen = expanded[g.id]
                const danger = g.id === 'overdue'
                return (
                  <div key={g.id}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3.5 h-11 text-left transition-colors duration-150 hover:bg-muted/40',
                        FOCUS_RING,
                      )}
                    >
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                      <span className={cn('text-[13px] font-semibold', danger && list.length > 0 && 'text-destructive')}>
                        {g.label}
                      </span>
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
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
                              onOpen={() => openFromList(task)}
                              onToggleDone={() => handleToggleDone(task)}
                              onSetPriority={p => handleSetPriority(task, p)}
                              onDelete={() => handleDelete(task.id)}
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

