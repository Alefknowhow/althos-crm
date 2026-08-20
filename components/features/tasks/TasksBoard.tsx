'use client'

/**
 * TasksBoard — lista compacta agrupada em 3 seções independentes
 * (Pendentes/Atrasadas/Concluídas), cada uma expansível/retrátil. Substituiu
 * a versão anterior (Kanban + calendário/lista split) por decisão explícita
 * do usuário: menos telas, leitura mais rápida, sem duplicar a mesma tarefa
 * entre grupos. A classificação é sempre derivada de status/due_date — nunca
 * um campo próprio — então uma tarefa muda de grupo sozinha ao vencer ou ao
 * ser concluída, sem ação extra do usuário.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import LeadCombobox from '@/components/features/LeadCombobox'
import UserAvatar from '@/components/features/UserAvatar'
import { updateTask, deleteTask, toggleTaskStatus, setTaskPriority } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  User2, UserCheck, CheckCircle2, Circle, Calendar, Search,
  Trash2, X, ChevronDown, ChevronRight, MoreVertical, Pencil,
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

const GROUPS: { id: GroupId; label: string; empty: string }[] = [
  { id: 'pending',  label: 'Pendentes',  empty: 'Nenhuma tarefa pendente' },
  { id: 'overdue',  label: 'Atrasadas',  empty: 'Nenhuma tarefa atrasada' },
  { id: 'done',     label: 'Concluídas', empty: 'Nenhuma tarefa concluída' },
]

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

/** Horário opcional (HH:mm) embutido no due_date — data e hora ficam ambas
 *  ancoradas em UTC, então "sem horário definido" é o padrão 00:00. */
function dueTimeOnly(iso?: string | null): string | null {
  if (!iso) return null
  const t = iso.split('T')[1]?.slice(0, 5)
  return t && t !== '00:00' ? t : null
}

/** Combina data (YYYY-MM-DD) + horário opcional (HH:mm) num ISO em UTC. */
function combineDueDate(date: string, time: string): string | null {
  if (!date) return null
  return `${date}T${time || '00:00'}:00.000Z`
}

function classify(t: Task): GroupId {
  if (t.status === 'done') return 'done'
  if (isOverdue(t)) return 'overdue'
  return 'pending'
}

const PRIORITY_META: Record<Task['priority'], { label: string; cls: string; dot: string }> = {
  low:    { label: 'Baixa', cls: 'bg-success/15 text-success border-success/20',           dot: 'bg-success' },
  normal: { label: 'Média', cls: 'bg-warning/15 text-warning border-warning/20',           dot: 'bg-warning' },
  high:   { label: 'Alta',  cls: 'bg-destructive/15 text-destructive border-destructive/20', dot: 'bg-destructive' },
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const EXPANDED_STORAGE_KEY = 'tasks-groups-expanded'
const DEFAULT_EXPANDED: Record<GroupId, boolean> = { pending: true, overdue: true, done: false }

export default function TasksBoard({
  initialTasks,
  orgSlug,
  members = [],
  currentUserId,
  headerAction,
}: {
  initialTasks: Task[]
  orgSlug: string
  members?: Member[]
  /** Usuário logado — habilita o chip rápido "Minhas". */
  currentUserId?: string
  /** Botão "Nova tarefa", renderizado ao lado dos filtros. */
  headerAction?: React.ReactNode
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [assignee, setAssignee] = useState<AssigneeFilter>('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>(DEFAULT_EXPANDED)

  useEffect(() => { setTasks(initialTasks) }, [initialTasks])

  // Persiste o estado de expansão durante a sessão (não entre sessões).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY)
      if (raw) setExpanded({ ...DEFAULT_EXPANDED, ...JSON.parse(raw) })
    } catch { /* ignora sessionStorage indisponível */ }
  }, [])
  function toggleGroup(id: GroupId) {
    setExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

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
      (!onlyMine || t.assigned_to === currentUserId) &&
      matchesSearch(t, search),
    ),
    [tasks, priority, assignee, onlyMine, currentUserId, search],
  )

  const grouped = useMemo(() => {
    const byGroup: Record<GroupId, Task[]> = { pending: [], overdue: [], done: [] }
    for (const t of filtered) byGroup[classify(t)].push(t)
    for (const id of Object.keys(byGroup) as GroupId[]) {
      byGroup[id].sort((a, b) => {
        const da = dueDateOnly(a)?.getTime() ?? Infinity
        const db = dueDateOnly(b)?.getTime() ?? Infinity
        return da - db
      })
    }
    return byGroup
  }, [filtered])

  const assigneeCounts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length, none: 0 }
    for (const t of tasks) {
      if (!t.assigned_to) c.none++
      else c[t.assigned_to] = (c[t.assigned_to] ?? 0) + 1
    }
    return c
  }, [tasks])

  const priorityCounts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length, low: 0, normal: 0, high: 0 }
    for (const t of tasks) c[t.priority] = (c[t.priority] ?? 0) + 1
    return c
  }, [tasks])

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
        {headerAction && <div className="ml-auto">{headerAction}</div>}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {members.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground mr-1 inline-flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />Responsável:
            </span>
            <ResponsiveSelect
              className="h-8 w-[180px] text-xs"
              aria-label="Filtrar por responsável"
              value={assignee}
              onValueChange={v => setAssignee(v as AssigneeFilter)}
              options={[
                { value: 'all', label: `Todos (${assigneeCounts.all})` },
                { value: 'none', label: `Sem responsável (${assigneeCounts.none})` },
                ...members.map(m => ({ value: m.user_id, label: `${m.name} (${assigneeCounts[m.user_id] ?? 0})` })),
              ]}
            />
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
                FOCUS_RING,
                priority === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border',
              )}
            >
              {p === 'all' ? 'Todas' : PRIORITY_META[p].label}
              <span className="ml-1 opacity-60">{(priorityCounts as any)[p] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grupos */}
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
                        onOpen={() => setEditing(task)}
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

// ── Linha da tarefa ──────────────────────────────────────────────────────────

function TaskListRow({
  task, orgSlug, members, onOpen, onToggleDone, onSetPriority, onDelete,
}: {
  task: Task
  orgSlug: string
  members: Member[]
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
    <div className="group flex items-center gap-3 px-3.5 h-[50px] hover:bg-muted/30 transition-colors duration-150">
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

      {/* Título — flexível, ocupa o espaço restante */}
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

      {/* Lead vinculado (opcional) — some primeiro em telas menores */}
      {task.leads && (
        <Link
          href={`/app/${orgSlug}/contatos/${task.leads.id}`}
          onClick={e => e.stopPropagation()}
          className="hidden xl:inline text-xs text-primary hover:underline truncate max-w-[140px] shrink-0"
        >
          {task.leads.name}
        </Link>
      )}

      {/* Responsável */}
      <div className="hidden sm:flex items-center gap-1.5 w-[150px] shrink-0">
        {member && (
          <>
            <UserAvatar name={member.name} email={member.email} size={22} />
            <span className="text-xs text-muted-foreground truncate">{member.name}</span>
          </>
        )}
      </div>

      {/* Prazo */}
      <div className="w-[80px] shrink-0 flex items-center gap-1 text-xs">
        {date ? (
          <span className={cn('inline-flex items-center gap-1', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
            <Calendar className="w-3 h-3 shrink-0" />
            {date}{time && <span className="hidden sm:inline">{` ${time}`}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Prioridade */}
      <div className="hidden sm:block w-[56px] shrink-0">
        <Badge variant="outline" className={cn('text-[10px] px-1.5 h-4 rounded-full', pm.cls)}>{pm.label}</Badge>
      </div>

      {/* Ações */}
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

// ── Drawer de edição ─────────────────────────────────────────────────────────

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
