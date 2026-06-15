'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  updateTask, deleteTask, toggleTaskStatus,
  moveTaskToColumn, createTaskColumn, renameTaskColumn, deleteTaskColumn,
} from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  LayoutGrid, List as ListIcon, Calendar, User2, UserCheck, CheckCircle2, Circle,
  Clock, GripVertical, Trash2, Plus, Check, X, Pencil,
} from 'lucide-react'

type Member = { user_id: string; name: string; email: string }

type Column = { id: string; name: string; position: number }

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

type View = 'kanban' | 'list'
type PriorityFilter = 'all' | 'low' | 'normal' | 'high'
type AssigneeFilter = 'all' | 'none' | string
type DateFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'next_week' | 'this_month'

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'overdue',    label: 'Atrasadas' },
  { id: 'today',      label: 'Hoje' },
  { id: 'this_week',  label: 'Esta semana' },
  { id: 'next_week',  label: 'Próxima semana' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'all',        label: 'Todas' },
]

function dueDateOnly(t: Task): Date | null {
  if (!t.due_date) return null
  const [y, m, d] = t.due_date.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const PRIORITY_META: Record<Task['priority'], { label: string; cls: string; bar: string }> = {
  low:    { label: 'Baixa', cls: 'bg-green-100 text-green-800 border-green-200',   bar: 'bg-green-400' },
  normal: { label: 'Média', cls: 'bg-amber-100 text-amber-800 border-amber-200',   bar: 'bg-amber-400' },
  high:   { label: 'Alta',  cls: 'bg-red-100 text-red-800 border-red-200',         bar: 'bg-red-500' },
}

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function isOverdue(t: Task) {
  return !!t.due_date && t.due_date.split('T')[0] < todayISO() && t.status !== 'done'
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })
}

/** Sort helper: keeps pending tasks on top and pushes completed ones to the
 *  bottom while preserving the incoming order within each group. */
function doneLast(list: Task[]): Task[] {
  const pending = list.filter(t => t.status !== 'done')
  const done = list.filter(t => t.status === 'done')
  return [...pending, ...done]
}

export default function TasksBoard({
  initialTasks,
  initialColumns,
  orgSlug,
  members = [],
}: {
  initialTasks: Task[]
  initialColumns: Column[]
  orgSlug: string
  members?: Member[]
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [view, setView] = useState<View>('kanban')
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [assignee, setAssignee] = useState<AssigneeFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [editing, setEditing] = useState<Task | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [colDraft, setColDraft] = useState('')

  // Re-sync when the server sends fresh data (after router.refresh()).
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])
  useEffect(() => { setColumns(initialColumns) }, [initialColumns])

  // Restore preferred view (avoid SSR hydration mismatch by reading after mount).
  useEffect(() => {
    const v = localStorage.getItem('tasks-view')
    if (v === 'kanban' || v === 'list') setView(v)
  }, [])
  function pickView(v: View) {
    setView(v)
    localStorage.setItem('tasks-view', v)
  }

  // On mobile, only the list view is available (kanban needs horizontal space).
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  const effectiveView: View = isMobile ? 'list' : view

  // Week/month boundaries (recomputed per render — cheap, keeps "today" fresh).
  const bounds = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
    const nextWeekStart = new Date(weekStart); nextWeekStart.setDate(weekStart.getDate() + 7)
    const nextWeekEnd = new Date(weekEnd); nextWeekEnd.setDate(weekEnd.getDate() + 7)
    return { now, weekStart, weekEnd, nextWeekStart, nextWeekEnd }
  }, [tasks])

  function matchesDate(t: Task, f: DateFilter): boolean {
    if (f === 'all') return true
    const d = dueDateOnly(t)
    if (!d) return false
    const { now, weekStart, weekEnd, nextWeekStart, nextWeekEnd } = bounds
    switch (f) {
      case 'overdue':    return d < now && t.status !== 'done'
      case 'today':      return d.getTime() === now.getTime()
      case 'this_week':  return d >= weekStart && d <= weekEnd
      case 'next_week':  return d >= nextWeekStart && d <= nextWeekEnd
      case 'this_month': return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      default:           return true
    }
  }

  function matchesAssignee(t: Task, f: AssigneeFilter): boolean {
    if (f === 'all') return true
    if (f === 'none') return !t.assigned_to
    return t.assigned_to === f
  }

  const filtered = useMemo(
    () => tasks.filter(t =>
      (priority === 'all' || t.priority === priority) &&
      matchesAssignee(t, assignee) &&
      matchesDate(t, dateFilter),
    ),
    [tasks, priority, assignee, dateFilter, bounds],
  )

  const dateCounts = useMemo(() => {
    const c: Record<DateFilter, number> = { all: tasks.length, overdue: 0, today: 0, this_week: 0, next_week: 0, this_month: 0 }
    for (const t of tasks) {
      for (const f of ['overdue', 'today', 'this_week', 'next_week', 'this_month'] as DateFilter[]) {
        if (matchesDate(t, f)) c[f]++
      }
    }
    return c
  }, [tasks, bounds])

  // Group tasks by column. Tasks with no/unknown column fall into the first one.
  const byColumn = useMemo(() => {
    const firstId = columns[0]?.id ?? null
    const valid = new Set(columns.map(c => c.id))
    const map: Record<string, Task[]> = {}
    for (const c of columns) map[c.id] = []
    for (const t of filtered) {
      const key = t.column_id && valid.has(t.column_id) ? t.column_id : firstId
      if (key) (map[key] ??= []).push(t)
    }
    for (const k of Object.keys(map)) map[k] = doneLast(map[k])
    return map
  }, [filtered, columns])

  async function moveTo(taskId: string, columnId: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.column_id === columnId) return
    const prevCol = task.column_id ?? null
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, column_id: columnId } : t)))
    const res = await moveTaskToColumn(orgSlug, taskId, columnId)
    if (!res.ok) {
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, column_id: prevCol } : t)))
      toast.error('Erro ao mover tarefa')
      return
    }
    router.refresh()
  }

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

  async function handleDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    setEditing(null)
    const res = await deleteTask(orgSlug, id)
    if (!res.ok) {
      toast.error('Erro ao excluir tarefa')
      router.refresh()
      return
    }
    toast.success('Tarefa excluída')
    router.refresh()
  }

  // --- Column management ----------------------------------------------------
  async function handleAddColumn() {
    const res = await createTaskColumn(orgSlug, 'Nova coluna')
    if (!res.ok || !res.column) {
      toast.error('Erro ao criar coluna')
      return
    }
    setColumns(prev => [...prev, res.column!])
    setEditingColId(res.column.id)
    setColDraft(res.column.name)
    router.refresh()
  }

  function startEditCol(col: Column) {
    setEditingColId(col.id)
    setColDraft(col.name)
  }

  async function commitEditCol() {
    const id = editingColId
    if (!id) return
    const name = colDraft.trim()
    setEditingColId(null)
    const current = columns.find(c => c.id === id)
    if (!name || name === current?.name) return
    setColumns(prev => prev.map(c => (c.id === id ? { ...c, name } : c)))
    const res = await renameTaskColumn(orgSlug, id, name)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao renomear coluna')
      if (current) setColumns(prev => prev.map(c => (c.id === id ? { ...c, name: current.name } : c)))
      return
    }
    router.refresh()
  }

  async function handleDeleteColumn(col: Column) {
    if (columns.length <= 1) {
      toast.error('Mantenha ao menos uma coluna.')
      return
    }
    const count = byColumn[col.id]?.length ?? 0
    const msg = count > 0
      ? `Excluir "${col.name}"? As ${count} tarefa(s) serão movidas para a primeira coluna.`
      : `Excluir a coluna "${col.name}"?`
    if (!window.confirm(msg)) return

    const fallback = columns.find(c => c.id !== col.id)
    setColumns(prev => prev.filter(c => c.id !== col.id))
    if (fallback) {
      setTasks(prev => prev.map(t => (t.column_id === col.id ? { ...t, column_id: fallback.id } : t)))
    }
    const res = await deleteTaskColumn(orgSlug, col.id)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao excluir coluna')
      router.refresh()
      return
    }
    router.refresh()
  }

  const counts = { all: tasks.length, ...(['low', 'normal', 'high'] as const).reduce(
    (acc, p) => ({ ...acc, [p]: tasks.filter(t => t.priority === p).length }), {} as Record<string, number>) }

  const assigneeCounts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length, none: 0 }
    for (const t of tasks) {
      if (!t.assigned_to) c.none++
      else c[t.assigned_to] = (c[t.assigned_to] ?? 0) + 1
    }
    return c
  }, [tasks])

  return (
    <div className="space-y-4">
      {/* Date filters — pills on desktop, dropdown on mobile to save space. */}
      <div className="hidden sm:flex flex-wrap items-center gap-1.5">
        {DATE_FILTERS.map(f => {
          const active = dateFilter === f.id
          const count = dateCounts[f.id]
          const danger = f.id === 'overdue'
          return (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors',
                active
                  ? (danger ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-primary text-primary-foreground border-primary')
                  : (danger && count > 0
                      ? 'bg-destructive/5 text-destructive border-destructive/30 hover:bg-destructive/10'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border'),
              )}
            >
              {f.label}
              <span className={cn('tabular-nums', active ? 'opacity-80' : 'opacity-60')}>{count}</span>
            </button>
          )
        })}
      </div>
      <select
        value={dateFilter}
        onChange={e => setDateFilter(e.target.value as DateFilter)}
        className="sm:hidden w-full h-9 rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground"
      >
        {DATE_FILTERS.map(f => (
          <option key={f.id} value={f.id}>
            {f.label} ({dateCounts[f.id]})
          </option>
        ))}
      </select>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden sm:inline-flex rounded-lg border bg-muted/30 p-0.5">
          <ViewBtn active={view === 'kanban'} onClick={() => pickView('kanban')} icon={LayoutGrid} label="Kanban" />
          <ViewBtn active={view === 'list'} onClick={() => pickView('list')} icon={ListIcon} label="Lista" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {members.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground mr-1 inline-flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />Responsável:
              </span>
              <select
                value={assignee}
                onChange={e => setAssignee(e.target.value as AssigneeFilter)}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground"
              >
                <option value="all">Todos ({assigneeCounts.all})</option>
                <option value="none">Sem responsável ({assigneeCounts.none})</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} ({assigneeCounts[m.user_id] ?? 0})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground mr-1">Prioridade:</span>
            {(['all', 'high', 'normal', 'low'] as PriorityFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={cn(
                  'px-2.5 h-7 rounded-md border transition-colors font-medium',
                  priority === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted text-muted-foreground border-border',
                )}
              >
                {p === 'all' ? 'Todas' : PRIORITY_META[p].label}
                <span className="ml-1 opacity-60">{(counts as any)[p] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Board */}
      {effectiveView === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-2 items-start">
          {columns.map(col => (
            <div
              key={col.id}
              onDragOver={e => { e.preventDefault(); setOverCol(col.id) }}
              onDragLeave={() => setOverCol(c => (c === col.id ? null : c))}
              onDrop={e => {
                e.preventDefault()
                const id = dragId || e.dataTransfer.getData('text/plain')
                if (id) moveTo(id, col.id)
                setDragId(null)
                setOverCol(null)
              }}
              className={cn(
                'rounded-xl border bg-muted/20 border-t-2 border-t-primary/40 flex flex-col min-h-[200px] w-[300px] shrink-0 transition-colors',
                overCol === col.id && 'bg-primary/5 ring-2 ring-primary/30',
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                {editingColId === col.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      autoFocus
                      value={colDraft}
                      onChange={e => setColDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEditCol()
                        if (e.key === 'Escape') setEditingColId(null)
                      }}
                      className="h-7 text-sm font-semibold"
                    />
                    <button onClick={commitEditCol} className="text-green-600 hover:text-green-700 shrink-0" aria-label="Salvar">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingColId(null)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Cancelar">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => startEditCol(col)}
                      className="group flex items-center gap-1.5 min-w-0"
                      title="Renomear coluna"
                    >
                      <span className="text-sm font-semibold truncate">{col.name}</span>
                      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums bg-background border rounded-full px-2 py-0.5">
                        {byColumn[col.id]?.length ?? 0}
                      </span>
                      {columns.length > 1 && (
                        <button
                          onClick={() => handleDeleteColumn(col)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                          aria-label="Excluir coluna"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
                {(byColumn[col.id]?.length ?? 0) === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                    Arraste tarefas para cá
                  </div>
                ) : (
                  byColumn[col.id].map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onOpen={() => setEditing(task)}
                      onToggleDone={() => handleToggleDone(task)}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}

          {/* Add column */}
          <button
            onClick={handleAddColumn}
            className="w-[220px] shrink-0 min-h-[120px] rounded-xl border-2 border-dashed text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1.5 text-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            Nova coluna
          </button>
        </div>
      ) : (
        <div className="rounded-xl border divide-y bg-card">
          {doneLast(filtered).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Nenhuma tarefa nesta visão.</div>
          ) : (
            doneLast(filtered).map(task => (
              <TaskRow
                key={task.id}
                task={task}
                orgSlug={orgSlug}
                columnName={columns.find(c => c.id === task.column_id)?.name ?? columns[0]?.name ?? ''}
                onOpen={() => setEditing(task)}
                onToggleDone={() => handleToggleDone(task)}
              />
            ))
          )}
        </div>
      )}

      {/* Edit sheet */}
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
    </div>
  )
}

function ViewBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors',
        active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function KanbanCard({
  task, onOpen, onToggleDone, onDragStart, onDragEnd,
}: {
  task: Task
  onOpen: () => void
  onToggleDone: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const pm = PRIORITY_META[task.priority]
  const overdue = isOverdue(task)
  const date = fmtDate(task.due_date)
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        'group relative rounded-lg border bg-card p-3 pl-4 shadow-sm hover:shadow-md hover:border-primary/40 cursor-pointer transition-all',
        task.status === 'done' && 'opacity-70',
      )}
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg', pm.bar)} />
      <div className="flex items-start gap-2">
        <button
          onClick={e => { e.stopPropagation(); onToggleDone() }}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
          aria-label={task.status === 'done' ? 'Reabrir' : 'Concluir'}
        >
          {task.status === 'done'
            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
            : <Circle className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium leading-snug', task.status === 'done' && 'line-through text-muted-foreground')}>
            {task.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('text-[10px] px-1.5 h-4', pm.cls)}>{pm.label}</Badge>
            {date && (
              <span className={cn('inline-flex items-center gap-1 text-[11px]', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                <Calendar className="w-3 h-3" />{date}
              </span>
            )}
            {task.leads && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[120px]">
                <User2 className="w-3 h-3" />{task.leads.name}
              </span>
            )}
            {task.assignee_name && (
              <span className="inline-flex items-center gap-1 text-[11px] text-primary/80 truncate max-w-[120px]" title={`Responsável: ${task.assignee_name}`}>
                <UserCheck className="w-3 h-3" />{task.assignee_name}
              </span>
            )}
          </div>
        </div>
        <GripVertical className="w-4 h-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  )
}

function TaskRow({
  task, orgSlug, columnName, onOpen, onToggleDone,
}: {
  task: Task
  orgSlug: string
  columnName: string
  onOpen: () => void
  onToggleDone: () => void
}) {
  const pm = PRIORITY_META[task.priority]
  const overdue = isOverdue(task)
  const date = fmtDate(task.due_date)
  const statusName = task.status === 'done' ? 'Concluído' : columnName
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
      <button
        onClick={onToggleDone}
        className="shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
        aria-label={task.status === 'done' ? 'Reabrir' : 'Concluir'}
      >
        {task.status === 'done'
          ? <CheckCircle2 className="w-5 h-5 text-green-600" />
          : <Circle className="w-5 h-5" />}
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <p className={cn('text-sm font-medium truncate', task.status === 'done' && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{statusName}</span>
          {date && <span className={overdue ? 'text-destructive font-medium' : ''}>· {date}</span>}
          {task.assignee_name && (
            <span className="inline-flex items-center gap-1 text-primary/80">
              <UserCheck className="w-3 h-3" />{task.assignee_name}
            </span>
          )}
        </div>
      </div>

      {/* Lead name — fixed-width column, right-aligned, sits to the LEFT of the
          priority badge so both line up consistently across every row. */}
      <div className="hidden sm:flex w-[160px] shrink-0 justify-end">
        {task.leads && (
          <Link
            href={`/app/${orgSlug}/contatos/${task.leads.id}`}
            onClick={e => e.stopPropagation()}
            className="text-xs text-primary hover:underline truncate"
          >
            {task.leads.name}
          </Link>
        )}
      </div>

      {/* Priority badge — fixed-width slot keeps all badges aligned in a column. */}
      <div className="w-[64px] shrink-0 flex justify-start">
        <Badge variant="outline" className={cn('text-[10px] px-1.5 h-4', pm.cls)}>{pm.label}</Badge>
      </div>
    </div>
  )
}

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
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!task) return
    const fd = new FormData(e.currentTarget)
    const input = {
      title:       fd.get('title')       as string,
      description: fd.get('description') as string,
      due_date:    fd.get('due_date')    as string,
      priority:    fd.get('priority')    as 'low' | 'normal' | 'high',
      contato_id:     fd.get('contato_id')     as string,
      assigned_to: fd.get('assigned_to') as string,
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

  return (
    <Sheet open={!!task} onOpenChange={o => !o && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>Editar Tarefa</SheetTitle></SheetHeader>
        {task && (
          <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input name="title" required defaultValue={task.title} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <textarea name="description" className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={task.description || ''} />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input type="date" name="due_date" defaultValue={defaultDate} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <select name="priority" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" defaultValue={task.priority}>
                <option value="low">Baixa</option>
                <option value="normal">Média</option>
                <option value="high">Alta</option>
              </select>
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
                <select name="assigned_to" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" defaultValue={task.assigned_to || ''}>
                  <option value="">Sem responsável</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.name}</option>
                  ))}
                </select>
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
