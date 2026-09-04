/**
 * Types, pure date/format helpers and shared constants for TasksBoard
 * and its calendar/task-view sub-components. Split out of TasksBoard.tsx.
 * No 'use client' needed -- nothing here uses hooks or browser APIs.
 */

export type Member = { user_id: string; name: string; email: string }

export type Task = {
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

export type PriorityFilter = 'all' | 'low' | 'normal' | 'high'
export type AssigneeFilter = 'all' | 'none' | string
export type GroupId = 'overdue' | 'today' | 'upcoming' | 'done'
export type StatusFilter = 'all' | GroupId
export type RelatedFilter = 'all' | string
export type CalView = 'month' | 'week'

export const GROUPS: { id: GroupId; label: string; empty: string }[] = [
  { id: 'overdue',  label: 'Atrasadas',  empty: 'Nenhuma tarefa atrasada.' },
  { id: 'today',    label: 'Hoje',       empty: 'Nenhuma tarefa para hoje.' },
  { id: 'upcoming', label: 'Próximas',   empty: 'Nenhuma tarefa programada.' },
  { id: 'done',     label: 'Concluídas', empty: 'Nenhuma tarefa concluída.' },
]

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'overdue',  label: 'Atrasadas' },
  { value: 'today',    label: 'Hoje' },
  { value: 'upcoming', label: 'Próximas' },
  { value: 'done',     label: 'Concluídas' },
]

export const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const ROW_H = 40 // px por hora, na visão Semana

export function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export function dueDateOnly(t: Task): Date | null {
  if (!t.due_date) return null
  const [y, m, d] = t.due_date.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function isOverdue(t: Task) {
  return !!t.due_date && t.due_date.split('T')[0] < todayISO() && t.status !== 'done'
}

export function fmtDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })
}

/** Horário opcional (HH:mm) embutido no due_date — "sem horário" é o padrão 00:00. */
export function dueTimeOnly(iso?: string | null): string | null {
  if (!iso) return null
  const t = iso.split('T')[1]?.slice(0, 5)
  return t && t !== '00:00' ? t : null
}

export function combineDueDate(date: string, time: string): string | null {
  if (!date) return null
  return `${date}T${time || '00:00'}:00.000Z`
}

export function classify(t: Task): GroupId {
  if (t.status === 'done') return 'done'
  const d = t.due_date?.split('T')[0]
  if (!d) return 'upcoming'
  if (d < todayISO()) return 'overdue'
  if (d === todayISO()) return 'today'
  return 'upcoming'
}

export function completedAtMs(t: Task): number {
  const iso = t.completed_at || t.created_at /* fallback shouldn't happen post-backfill */
  return iso ? new Date(iso).getTime() : 0
}

export function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
export function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
export function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x }
export function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function addWeeks(d: Date, n: number) { return addDays(d, n * 7) }
export function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// 8 cores determinísticas por responsável, indexadas por hash do user_id —
// o mesmo responsável sempre pega a mesma cor em toda a lista de tarefas.
export const MEMBER_LABEL_COLORS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
]

export function memberLabelColor(userId: string | null | undefined): string {
  if (!userId) return 'bg-muted text-muted-foreground'
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return MEMBER_LABEL_COLORS[h % MEMBER_LABEL_COLORS.length]
}

export const PRIORITY_META: Record<Task['priority'], { label: string; cls: string; dot: string }> = {
  low:    { label: 'Baixa', cls: 'bg-success/15 text-success border-success/20',           dot: 'bg-success' },
  normal: { label: 'Média', cls: 'bg-warning/15 text-warning border-warning/20',           dot: 'bg-warning' },
  high:   { label: 'Alta',  cls: 'bg-destructive/15 text-destructive border-destructive/20', dot: 'bg-destructive' },
}

/** Cor do indicador (bolinha) por estado — funcional, não decorativo:
 *  pendente = tom neutro, atrasada = alerta discreto, concluída = verde sutil. */
export function stateDotClass(t: Task): string {
  const g = classify(t)
  if (g === 'done') return 'bg-success'
  if (g === 'overdue') return 'bg-warning'
  return 'bg-muted-foreground'
}

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

// v2: shape mudou de 3 grupos (pending/overdue/done) pra 4
// (overdue/today/upcoming/done) — chave nova evita ler um JSON velho
// incompatível de sessão anterior.
export const EXPANDED_STORAGE_KEY = 'tasks-groups-expanded-v2'
export const DEFAULT_EXPANDED: Record<GroupId, boolean> = { overdue: true, today: true, upcoming: true, done: false }

