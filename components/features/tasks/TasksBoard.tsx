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

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import LeadCombobox from '@/components/features/LeadCombobox'
import UserAvatar from '@/components/features/UserAvatar'
import TaskDialog from '@/components/features/TaskDialog'
import { updateTask, deleteTask, toggleTaskStatus, setTaskPriority } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  User2, UserCheck, CheckCircle2, Circle, Calendar, Search,
  Trash2, X, ChevronDown, ChevronRight, ChevronLeft, MoreVertical, Pencil, Plus,
} from 'lucide-react'

type Member = { user_id: string; name: string; email: string }

type Task = {
  id: string
  title: string
  description?: string | null
  status: 'open' | 'doing' | 'done'
  priority: 'low' | 'normal' | 'high'
  due_date?: string | null
  assigned_to?: string | null
  assignee_name?: string | null
  column_id?: string | null
  leads?: { id: string; name: string } | null
}

type PriorityFilter = 'all' | 'low' | 'normal' | 'high'
type AssigneeFilter = 'all' | 'none' | string
type GroupId = 'pending' | 'overdue' | 'done'
type StatusFilter = 'all' | GroupId
type CalView = 'month' | 'week'

const GROUPS: { id: GroupId; label: string; empty: string }[] = [
  { id: 'pending',  label: 'Pendentes',  empty: 'Nenhuma tarefa pendente' },
  { id: 'overdue',  label: 'Atrasadas',  empty: 'Nenhuma tarefa atrasada' },
  { id: 'done',     label: 'Concluídas', empty: 'Nenhuma tarefa concluída' },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',     label: 'Todos os status' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'done',    label: 'Concluídas' },
]

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ROW_H = 40 // px por hora, na visão Semana

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function dueDateOnly(t: Task): Date | null {
  if (!t.due_date) return null
  const [y, m, d] = t.due_date.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function isOverdue(t: Task) {
  return !!t.due_date && t.due_date.split('T')[0] < todayISO() && t.status !== 'done'
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })
}

/** Horário opcional (HH:mm) embutido no due_date — "sem horário" é o padrão 00:00. */
function dueTimeOnly(iso?: string | null): string | null {
  if (!iso) return null
  const t = iso.split('T')[1]?.slice(0, 5)
  return t && t !== '00:00' ? t : null
}

function combineDueDate(date: string, time: string): string | null {
  if (!date) return null
  return `${date}T${time || '00:00'}:00.000Z`
}

function classify(t: Task): GroupId {
  if (t.status === 'done') return 'done'
  if (isOverdue(t)) return 'overdue'
  return 'pending'
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addWeeks(d: Date, n: number) { return addDays(d, n * 7) }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const PRIORITY_META: Record<Task['priority'], { label: string; cls: string; dot: string }> = {
  low:    { label: 'Baixa', cls: 'bg-success/15 text-success border-success/20',           dot: 'bg-success' },
  normal: { label: 'Média', cls: 'bg-warning/15 text-warning border-warning/20',           dot: 'bg-warning' },
  high:   { label: 'Alta',  cls: 'bg-destructive/15 text-destructive border-destructive/20', dot: 'bg-destructive' },
}

/** Cor do indicador (bolinha) por estado — funcional, não decorativo:
 *  pendente = tom neutro, atrasada = alerta discreto, concluída = verde sutil. */
function stateDotClass(t: Task): string {
  const g = classify(t)
  if (g === 'done') return 'bg-success'
  if (g === 'overdue') return 'bg-warning'
  return 'bg-muted-foreground'
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const EXPANDED_STORAGE_KEY = 'tasks-groups-expanded'
const DEFAULT_EXPANDED: Record<GroupId, boolean> = { pending: true, overdue: true, done: false }

export default function TasksBoard({
  initialTasks,
  orgSlug,
  members = [],
  currentUserId,
}: {
  initialTasks: Task[]
  orgSlug: string
  members?: Member[]
  /** Usuário logado — habilita o chip rápido "Minhas". */
  currentUserId?: string
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [assignee, setAssignee] = useState<AssigneeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>(DEFAULT_EXPANDED)

  const [calView, setCalView] = useState<CalView>('month')
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()))
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [todayOnly, setTodayOnly] = useState(false)
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

  const filtered = useMemo(
    () => tasks.filter(t =>
      (priority === 'all' || t.priority === priority) &&
      matchesAssignee(t, assignee) &&
      (statusFilter === 'all' || classify(t) === statusFilter) &&
      (!onlyMine || t.assigned_to === currentUserId) &&
      matchesSearch(t, search),
    ),
    [tasks, priority, assignee, statusFilter, onlyMine, currentUserId, search],
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
  }, [filtered, todayOnly, calView, calMonth, weekAnchor])

  const grouped = useMemo(() => {
    const byGroup: Record<GroupId, Task[]> = { pending: [], overdue: [], done: [] }
    for (const t of periodTasks) byGroup[classify(t)].push(t)
    for (const id of Object.keys(byGroup) as GroupId[]) {
      byGroup[id].sort((a, b) => {
        const da = dueDateOnly(a)?.getTime() ?? Infinity
        const db = dueDateOnly(b)?.getTime() ?? Infinity
        return da - db
      })
    }
    return byGroup
  }, [periodTasks])

  const assigneeCounts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length, none: 0 }
    for (const t of tasks) {
      if (!t.assigned_to) c.none++
      else c[t.assigned_to] = (c[t.assigned_to] ?? 0) + 1
    }
    return c
  }, [tasks])

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
          onClick={() => setTodayOnly(v => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors shrink-0',
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
          <button
            type="button"
            onClick={() => { setCalMonth(startOfMonth(new Date())); setWeekAnchor(startOfWeek(new Date())) }}
            className={cn('px-2.5 h-8 rounded-md border text-xs font-medium hover:bg-muted transition-colors ml-1', FOCUS_RING)}
          >
            Hoje
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
              className="h-8 w-[150px] text-xs"
              aria-label="Filtrar por responsável"
              value={assignee}
              onValueChange={v => setAssignee(v as AssigneeFilter)}
              options={[
                { value: 'all', label: `Todos (${assigneeCounts.all})` },
                { value: 'none', label: `Sem responsável (${assigneeCounts.none})` },
                ...members.map(m => ({ value: m.user_id, label: `${m.name} (${assigneeCounts[m.user_id] ?? 0})` })),
              ]}
            />
          )}
          <ResponsiveSelect
            className="h-8 w-[130px] text-xs"
            aria-label="Filtrar por prioridade"
            value={priority}
            onValueChange={v => setPriority(v as PriorityFilter)}
            options={[
              { value: 'all', label: 'Toda prioridade' },
              { value: 'high', label: PRIORITY_META.high.label },
              { value: 'normal', label: PRIORITY_META.normal.label },
              { value: 'low', label: PRIORITY_META.low.label },
            ]}
          />
          <ResponsiveSelect
            className="h-8 w-[140px] text-xs"
            aria-label="Filtrar por status"
            value={statusFilter}
            onValueChange={v => setStatusFilter(v as StatusFilter)}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Corpo: lista 40% à esquerda + calendário 60% à direita */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="hidden lg:block lg:w-[60%] min-w-0 lg:order-2">
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

        {/* Lista — 40%, sempre escopada ao período visível no calendário */}
        <div className="w-full lg:w-[40%] min-w-0 space-y-2 lg:order-1">
          <div className="px-0.5">
            <span className="text-sm font-semibold">
              {todayOnly
                ? 'Tarefas de hoje'
                : calView === 'month'
                  ? `Tarefas de ${calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
                  : `Tarefas de ${weekRangeLabel(Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(weekAnchor), i)))}`}
            </span>
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
        defaultDate={quickAdd?.date}
        defaultTime={quickAdd?.time}
        open={!!quickAdd}
        onOpenChange={o => !o && setQuickAdd(null)}
        trigger={<span className="hidden" />}
      />
    </div>
  )
}

function weekRangeLabel(days: Date[]) {
  const start = days[0]
  const end = days[6]
  const sameMonth = start.getMonth() === end.getMonth()
  const fmt = (d: Date, withMonth: boolean) =>
    withMonth ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : d.toLocaleDateString('pt-BR', { day: '2-digit' })
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`
}

// ── Calendário — visão Mês ──────────────────────────────────────────────────

function MonthGrid({
  days, calMonth, todayYmd, tasksByDate, members, highlightId,
  openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey,
  onDropDay, onChipDragStart, onChipDragEnd, onQuickAdd, renderPopover,
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
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const visible = dayTasks.slice(0, 3)
          const overflow = dayTasks.length - visible.length
          const isDragOver = dragOverKey === `month:${key}`
          return (
            <div
              key={key}
              onDoubleClick={() => onQuickAdd(key)}
              onDragOver={e => { e.preventDefault(); setDragOverKey(`month:${key}`) }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={e => onDropDay(e, key)}
              title="Duplo clique para criar uma tarefa neste dia"
              className={cn(
                'min-h-[96px] sm:min-h-[108px] min-w-0 border-b border-r p-1.5 text-left align-top transition-colors',
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= 35 && 'border-b-0',
                !inMonth && 'bg-muted/20',
                isWeekend && inMonth && 'bg-muted/10',
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
              <div className="space-y-0.5">
                {visible.map(t => (
                  <CalendarTaskChip
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
                  <DayOverflowPopover
                    tasks={dayTasks}
                    members={members}
                    highlightId={highlightId}
                    label={`+ ${overflow} tarefa${overflow > 1 ? 's' : ''}`}
                    renderPopover={renderPopover}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Linha compacta de tarefa dentro da célula do mês — texto, não badge.
 *  Hover mostra um preview leve; clique abre o popover completo. */
function CalendarTaskChip({
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
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', stateDotClass(task))} />
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

function DayOverflowPopover({
  tasks, members, highlightId, label, renderPopover,
}: {
  tasks: Task[]
  members: Member[]
  highlightId: string | null
  label: string
  renderPopover: (task: Task, close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          className="w-full text-left text-[10px] text-muted-foreground hover:text-foreground px-1"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="start" onClick={e => e.stopPropagation()}>
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {tasks.map(t => {
            const time = dueTimeOnly(t.due_date)
            return (
              <Popover key={t.id}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-1.5',
                      t.status === 'done' && 'opacity-60 line-through',
                      highlightId === t.id && 'ring-1 ring-primary/50',
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', stateDotClass(t))} />
                    {time && <span className="text-muted-foreground tabular-nums">{time}</span>}
                    <span className="truncate">{t.title}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-0">
                  {renderPopover(t, () => setOpen(false))}
                </PopoverContent>
              </Popover>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Calendário — visão Semana ────────────────────────────────────────────────

function WeekTimeline({
  days, hours, todayYmd, tasksByDate, members, highlightId,
  openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey,
  onDropAllDay, onDropSlot, onChipDragStart, onChipDragEnd, onQuickAdd, renderPopover,
}: {
  days: Date[]
  hours: number[]
  todayYmd: string
  tasksByDate: Record<string, Task[]>
  members: Member[]
  highlightId: string | null
  openPopoverId: string | null
  setOpenPopoverId: (id: string | null) => void
  dragOverKey: string | null
  setDragOverKey: (k: string | null) => void
  onDropAllDay: (e: React.DragEvent, dayYmd: string) => void
  onDropSlot: (e: React.DragEvent, dayYmd: string, hour: number) => void
  onChipDragStart: (e: React.DragEvent, id: string) => void
  onChipDragEnd: () => void
  onQuickAdd: (d: string, t?: string) => void
  renderPopover: (task: Task, close: () => void) => React.ReactNode
}) {
  return (
    <div className="rounded-[8px] border bg-card overflow-hidden">
      {/* Cabeçalho dos dias — colunas de largura fixa (minmax(0,1fr)): texto
          de tarefa nunca pode forçar uma coluna a crescer além disso. */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b">
        <div />
        {days.map(d => {
          const key = ymd(d)
          const isToday = key === todayYmd
          return (
            <div key={key} className="py-2 text-center border-l min-w-0">
              <div className="text-[11px] text-muted-foreground">{WEEKDAYS_PT[d.getDay()]}</div>
              <div className={cn(
                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mt-0.5',
                isToday ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground',
              )}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dia inteiro */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-muted/10">
        <div className="text-[10px] text-muted-foreground px-1.5 py-2 uppercase tracking-wide">Dia inteiro</div>
        {days.map(d => {
          const key = ymd(d)
          const allDay = (tasksByDate[key] || []).filter(t => !dueTimeOnly(t.due_date))
          const isDragOver = dragOverKey === `allday:${key}`
          return (
            <div
              key={key}
              onDragOver={e => { e.preventDefault(); setDragOverKey(`allday:${key}`) }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={e => onDropAllDay(e, key)}
              className={cn('border-l px-1 py-1.5 space-y-0.5 min-h-[36px] min-w-0', isDragOver && 'bg-primary/5 ring-2 ring-inset ring-primary/40')}
            >
              {allDay.map(t => (
                <CalendarTaskChip
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
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] relative">
        {/* Coluna de horas */}
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: ROW_H }} className="text-[10px] text-muted-foreground text-right pr-1.5 -mt-[6px] tabular-nums">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {days.map(d => {
          const key = ymd(d)
          const timed = (tasksByDate[key] || []).filter(t => dueTimeOnly(t.due_date))
          return (
            <div key={key} className="relative border-l min-w-0">
              {hours.map(h => {
                const slotKey = `slot:${key}:${h}`
                const isDragOver = dragOverKey === slotKey
                return (
                  <div
                    key={h}
                    style={{ height: ROW_H }}
                    onDragOver={e => { e.preventDefault(); setDragOverKey(slotKey) }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={e => onDropSlot(e, key, h)}
                    onDoubleClick={() => onQuickAdd(key, `${String(h).padStart(2, '0')}:00`)}
                    className={cn('border-b border-border/60', isDragOver && 'bg-primary/5')}
                  />
                )
              })}

              {/* Tarefas com horário, posicionadas proporcionalmente */}
              {timed.map((t, idx) => {
                const time = dueTimeOnly(t.due_date)!
                const [hh, mm] = time.split(':').map(Number)
                const top = (hh - hours[0]) * ROW_H + (mm / 60) * ROW_H
                const overlap = timed.filter(o => dueTimeOnly(o.due_date) === time).length
                const overlapIdx = timed.filter(o => dueTimeOnly(o.due_date) === time).indexOf(t)
                return (
                  <div
                    key={t.id}
                    style={{ top, left: overlap > 1 ? `${(overlapIdx / overlap) * 100}%` : 0, width: overlap > 1 ? `${100 / overlap}%` : '100%' }}
                    className="absolute px-0.5 z-10"
                  >
                    <CalendarTaskChip
                      task={t}
                      members={members}
                      highlighted={highlightId === t.id}
                      open={openPopoverId === t.id}
                      onOpenChange={o => setOpenPopoverId(o ? t.id : null)}
                      onDragStart={e => onChipDragStart(e, t.id)}
                      onDragEnd={onChipDragEnd}
                      renderPopover={close => renderPopover(t, close)}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Popover de tarefa (clique no calendário) ─────────────────────────────────

function TaskPopoverContent({
  task, orgSlug, members, onToggleDone, onSetPriority, onEdit, onDelete,
}: {
  task: Task
  orgSlug: string
  members: Member[]
  onToggleDone: () => void
  onSetPriority: (p: Task['priority']) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const pm = PRIORITY_META[task.priority]
  const date = fmtDate(task.due_date)
  const time = dueTimeOnly(task.due_date)
  const done = task.status === 'done'
  const member = members.find(m => m.user_id === task.assigned_to)

  return (
    <div className="p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-sm font-semibold leading-snug', done && 'line-through text-muted-foreground')}>{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer"><Pencil className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {date && <p className="text-xs text-muted-foreground">{date}{time && ` · ${time}`}</p>}
      {member && (
        <div className="flex items-center gap-1.5">
          <UserAvatar name={member.name} email={member.email} size={20} />
          <span className="text-xs text-muted-foreground">{member.name}</span>
        </div>
      )}

      <div className="flex items-center gap-1">
        {(['low', 'normal', 'high'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onSetPriority(p)}
            className={cn(
              'text-[10px] px-2 h-5 rounded-full border transition-colors',
              task.priority === p ? PRIORITY_META[p].cls : 'text-muted-foreground border-border hover:bg-muted',
            )}
          >
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-3">{task.description}</p>
      )}

      {task.leads && (
        <Link href={`/app/${orgSlug}/contatos/${task.leads.id}`} className="text-xs text-primary hover:underline block">
          {task.leads.name}
        </Link>
      )}

      <Button size="sm" variant={done ? 'outline' : 'default'} onClick={onToggleDone} className="w-full gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> {done ? 'Reabrir' : 'Concluir'}
      </Button>
    </div>
  )
}

// ── Linha da tarefa (lista) ──────────────────────────────────────────────────

function TaskListRow({
  task, orgSlug, members, highlighted, onOpen, onToggleDone, onSetPriority, onDelete,
}: {
  task: Task
  orgSlug: string
  members: Member[]
  highlighted?: boolean
  onOpen: () => void
  onToggleDone: () => void
  onSetPriority: (p: Task['priority']) => void
  onDelete: () => void
}) {
  const pm = PRIORITY_META[task.priority]
  const overdue = isOverdue(task)
  const date = fmtDate(task.due_date)
  const time = dueTimeOnly(task.due_date)
  const done = task.status === 'done'
  const member = members.find(m => m.user_id === task.assigned_to)

  return (
    <div className={cn(
      'group relative flex items-center gap-3 pl-4 pr-3.5 h-[50px] hover:bg-muted/30 transition-colors duration-150',
      highlighted && 'bg-primary/5 ring-1 ring-inset ring-primary/40',
    )}>
      <span
        className={cn('absolute left-0 top-1 bottom-1 w-1.5 rounded-r-sm', pm.dot)}
        title={`Prioridade: ${pm.label}`}
        aria-label={`Prioridade: ${pm.label}`}
      />

      <button
        type="button"
        onClick={onToggleDone}
        aria-label={done ? 'Reabrir' : 'Concluir'}
        className={cn('shrink-0 transition-transform active:scale-90', FOCUS_RING, 'rounded-full')}
      >
        {done
          ? <CheckCircle2 className="w-[18px] h-[18px] text-success" />
          : <Circle className="w-[18px] h-[18px] text-muted-foreground hover:text-foreground transition-colors" />}
      </button>

      <button
        type="button"
        onClick={onOpen}
        title={task.title}
        className="flex-1 min-w-0 text-left"
      >
        <span className={cn(
          'text-sm font-medium truncate block',
          done ? 'line-through text-muted-foreground' : 'text-foreground',
        )}>
          {task.title}
        </span>
      </button>

      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {member && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground truncate max-w-[80px]">
            {(member.name || member.email || '').trim().split(/\s+/)[0]}
          </span>
        )}
      </div>

      <div className="w-[86px] shrink-0 flex items-center gap-1 text-xs">
        {date ? (
          <span className={cn('inline-flex items-center gap-1', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
            <Calendar className="w-3 h-3 shrink-0" />
            {date}{time ? ` · ${time}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Ações"
            className={cn(
              'shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/40 group-hover:text-muted-foreground hover:!text-foreground hover:bg-muted transition-colors',
              FOCUS_RING,
            )}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onOpen} className="cursor-pointer">
            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleDone} className="cursor-pointer">
            {done
              ? <><Circle className="w-3.5 h-3.5 mr-2" /> Reabrir</>
              : <><CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Concluir</>}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <span className={cn('w-2 h-2 rounded-full mr-2', pm.dot)} />
              Prioridade
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {(['low', 'normal', 'high'] as const).map(p => (
                <DropdownMenuItem key={p} onClick={() => onSetPriority(p)} className="cursor-pointer">
                  {PRIORITY_META[p].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-destructive focus:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ── Drawer de edição completa ────────────────────────────────────────────────

function EditSheet({
  task, orgSlug, members, onClose, onSaved, onDelete,
}: {
  task: Task | null
  orgSlug: string
  members: Member[]
  onClose: () => void
  onSaved: (t: Task) => void
  onDelete: (id: string) => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!task) return
    const fd = new FormData(e.currentTarget)
    const dueDateRaw = fd.get('due_date') as string
    const dueTimeRaw = fd.get('due_time') as string
    const input = {
      title:       fd.get('title')       as string,
      description: fd.get('description') as string,
      due_date:    combineDueDate(dueDateRaw, dueTimeRaw) || '',
      priority:    fd.get('priority')    as 'low' | 'normal' | 'high',
      contato_id:     fd.get('contato_id')     as string,
      assigned_to: ((fd.get('assigned_to') as string) === '__unassigned__' ? '' : fd.get('assigned_to') as string),
    }
    setSaving(true)
    const res = await updateTask(orgSlug, task.id, input)
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao salvar')
      return
    }
    toast.success('Tarefa atualizada!')
    const assignee_name = input.assigned_to
      ? (members.find(m => m.user_id === input.assigned_to)?.name ?? null)
      : null
    onSaved({ ...task, ...input, due_date: input.due_date || null, assignee_name })
  }

  const defaultDate = task?.due_date ? task.due_date.split('T')[0] : ''
  const defaultTime = dueTimeOnly(task?.due_date) || ''

  return (
    <Sheet open={!!task} onOpenChange={o => !o && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Editar Tarefa</SheetTitle></SheetHeader>
        {task && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input name="title" required defaultValue={task.title} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <textarea name="description" className="flex min-h-[80px] w-full rounded-md border border-input bg-input/25 px-3 py-2 text-sm" defaultValue={task.description || ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input type="date" name="due_date" defaultValue={defaultDate} />
              </div>
              <div className="space-y-2">
                <Label>Horário <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input type="time" name="due_time" defaultValue={defaultTime} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lead</Label>
              <LeadCombobox
                name="contato_id"
                orgSlug={orgSlug}
                defaultLead={task.leads ? { id: task.leads.id, name: task.leads.name } : null}
              />
            </div>
            {members.length > 0 && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select name="assigned_to" defaultValue={task.assigned_to || '__unassigned__'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Sem responsável</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <SheetFooter>
              <Button type="button" variant="destructive" onClick={() => onDelete(task.id)}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
