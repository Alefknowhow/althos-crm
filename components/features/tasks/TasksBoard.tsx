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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import RelatedEntityCombobox, { type RelatedOption } from '@/components/features/tasks/RelatedEntityCombobox'
import { relatedTypeOptions, RELATED_TYPE_LABELS, type RelatedTypeValue } from '@/lib/tasks/related-types'
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
  completed_at?: string | null
  created_at?: string | null
  assigned_to?: string | null
  assignee_name?: string | null
  column_id?: string | null
  sale_id?: string | null
  related_entity_type?: string | null
  related_entity_id?: string | null
  related?: { type: string; label: string } | null
  leads?: { id: string; name: string } | null
}

type PriorityFilter = 'all' | 'low' | 'normal' | 'high'
type AssigneeFilter = 'all' | 'none' | string
type GroupId = 'overdue' | 'today' | 'upcoming' | 'done'
type StatusFilter = 'all' | GroupId
type RelatedFilter = 'all' | string
type CalView = 'month' | 'week'

const GROUPS: { id: GroupId; label: string; empty: string }[] = [
  { id: 'overdue',  label: 'Atrasadas',  empty: 'Nenhuma tarefa atrasada.' },
  { id: 'today',    label: 'Hoje',       empty: 'Nenhuma tarefa para hoje.' },
  { id: 'upcoming', label: 'Próximas',   empty: 'Nenhuma tarefa programada.' },
  { id: 'done',     label: 'Concluídas', empty: 'Nenhuma tarefa concluída.' },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'overdue',  label: 'Atrasadas' },
  { value: 'today',    label: 'Hoje' },
  { value: 'upcoming', label: 'Próximas' },
  { value: 'done',     label: 'Concluídas' },
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
  const d = t.due_date?.split('T')[0]
  if (!d) return 'upcoming'
  if (d < todayISO()) return 'overdue'
  if (d === todayISO()) return 'today'
  return 'upcoming'
}

function completedAtMs(t: Task): number {
  const iso = t.completed_at || t.created_at /* fallback shouldn't happen post-backfill */
  return iso ? new Date(iso).getTime() : 0
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addWeeks(d: Date, n: number) { return addDays(d, n * 7) }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// 8 cores determinísticas por responsável, indexadas por hash do user_id —
// o mesmo responsável sempre pega a mesma cor em toda a lista de tarefas.
const MEMBER_LABEL_COLORS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
]

function memberLabelColor(userId: string | null | undefined): string {
  if (!userId) return 'bg-muted text-muted-foreground'
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return MEMBER_LABEL_COLORS[h % MEMBER_LABEL_COLORS.length]
}

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

// v2: shape mudou de 3 grupos (pending/overdue/done) pra 4
// (overdue/today/upcoming/done) — chave nova evita ler um JSON velho
// incompatível de sessão anterior.
const EXPANDED_STORAGE_KEY = 'tasks-groups-expanded-v2'
const DEFAULT_EXPANDED: Record<GroupId, boolean> = { overdue: true, today: true, upcoming: true, done: false }

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

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
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
function CalendarTaskDot({
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
              'text-[10px] px-2 h-5 rounded-pill border transition-colors',
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
  const relatedTypeLabel = task.related ? (RELATED_TYPE_LABELS[task.related.type as RelatedTypeValue] ?? 'Relacionado') : null
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div className={cn(
      'group relative flex items-center gap-3 pl-4 pr-3.5 py-2.5 min-h-[50px] hover:bg-muted/30 transition-colors duration-150',
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

      <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={task.title}
            className="flex-1 min-w-0 text-left space-y-0.5"
          >
            {/* Linha 1: título (esq.) | responsável (largura fixa) + data/hora (dir.).
                Grid com coluna 2 de largura fixa (180px) — o responsável
                sempre começa no mesmo x, com espaço reservado pra data/hora
                não empurrar nada. Linha 2 usa o mesmo template, então o
                vínculo cai exatamente na mesma posição. */}
            <div className="grid grid-cols-[1fr_180px] gap-x-2 items-center">
              <span className={cn(
                'text-sm font-bold truncate min-w-0',
                done ? 'line-through text-muted-foreground' : 'text-foreground',
              )}>
                {task.title}
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-20 shrink-0">
                  {member && (
                    <span className={cn('inline-block max-w-full truncate text-[10px] font-medium px-1.5 py-0.5 rounded-pill leading-none', memberLabelColor(member.user_id))}>
                      {member.name}
                    </span>
                  )}
                </span>
                <span className={cn(
                  'text-xs shrink-0',
                  date ? (overdue && !done ? 'text-destructive font-medium' : 'text-muted-foreground/80') : 'text-muted-foreground/40',
                )}>
                  {date ? `${date}${time ? ` · ${time}` : ''}` : 'Sem data'}
                </span>
              </span>
            </div>

            {/* Linha 2: descrição (esq.) | vínculo da tarefa (dir.). */}
            {(task.description || task.related) && (
              <div className="grid grid-cols-[1fr_180px] gap-x-2 items-center">
                <span className="text-xs text-muted-foreground truncate min-w-0">
                  {task.description || ''}
                </span>
                <span className="text-xs text-muted-foreground truncate whitespace-nowrap">
                  {task.related ? `${relatedTypeLabel}: ${task.related.label}` : ''}
                </span>
              </div>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0" onClick={e => e.stopPropagation()}>
          <TaskPopoverContent
            task={task} orgSlug={orgSlug} members={members}
            onToggleDone={() => { onToggleDone(); setPreviewOpen(false) }}
            onSetPriority={p => onSetPriority(p)}
            onEdit={() => { setPreviewOpen(false); onOpen() }}
            onDelete={() => { onDelete(); setPreviewOpen(false) }}
          />
        </PopoverContent>
      </Popover>

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
  task, orgSlug, members, niche, onClose, onSaved, onDelete,
}: {
  task: Task | null
  orgSlug: string
  members: Member[]
  niche?: string | null
  onClose: () => void
  onSaved: (t: Task) => void
  onDelete: (id: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [relatedType, setRelatedType] = useState<RelatedTypeValue>('contato')
  const [relatedOption, setRelatedOption] = useState<RelatedOption | null>(null)
  const typeOptions = relatedTypeOptions(niche)

  // Reinicializa o bloco "Relacionado a" sempre que abre uma tarefa diferente.
  useEffect(() => {
    if (!task) return
    if (task.leads) { setRelatedType('contato'); setRelatedOption({ id: task.leads.id, label: task.leads.name }) }
    else if (task.sale_id && task.related) { setRelatedType('reserva'); setRelatedOption({ id: task.sale_id, label: task.related.label }) }
    else if (task.related_entity_type && task.related_entity_id && task.related) { setRelatedType(task.related_entity_type as RelatedTypeValue); setRelatedOption({ id: task.related_entity_id, label: task.related.label }) }
    else { setRelatedType('contato'); setRelatedOption(null) }
  }, [task])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!task) return
    const fd = new FormData(e.currentTarget)
    const dueDateRaw = fd.get('due_date') as string
    const dueTimeRaw = fd.get('due_time') as string
    const relationPayload =
      relatedType === 'contato' ? { contato_id: relatedOption?.id || '' }
      : relatedType === 'reserva' ? { sale_id: relatedOption?.id || '' }
      : { related_entity_type: (relatedOption ? relatedType : '') as any, related_entity_id: relatedOption?.id || '' }
    const input = {
      title:       fd.get('title')       as string,
      description: fd.get('description') as string,
      due_date:    combineDueDate(dueDateRaw, dueTimeRaw) || '',
      priority:    fd.get('priority')    as 'low' | 'normal' | 'high',
      assigned_to: ((fd.get('assigned_to') as string) === '__unassigned__' ? '' : fd.get('assigned_to') as string),
      ...relationPayload,
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
    const related = relatedOption ? { type: relatedType, label: relatedOption.label } : null
    onSaved({ ...task, ...input, due_date: input.due_date || null, assignee_name, related })
  }

  const defaultDate = task?.due_date ? task.due_date.split('T')[0] : ''
  const defaultTime = dueTimeOnly(task?.due_date) || ''

  return (
    <Dialog open={!!task} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
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
              <Label>Relacionado a <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={relatedType}
                  onValueChange={v => { setRelatedType(v as RelatedTypeValue); setRelatedOption(null) }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <RelatedEntityCombobox
                  orgSlug={orgSlug}
                  entityType={relatedType}
                  defaultValue={relatedOption}
                  onChange={setRelatedOption}
                />
              </div>
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
            <DialogFooter>
              <Button type="button" variant="destructive" onClick={() => onDelete(task.id)}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
