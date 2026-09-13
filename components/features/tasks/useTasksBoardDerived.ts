import { useMemo } from 'react'
import {
  type Task, type PriorityFilter, type AssigneeFilter, type GroupId,
  type StatusFilter, type RelatedFilter, type CalView, type ViewMode, type ListPeriod,
  todayISO, dueDateOnly, dueTimeOnly, classify, completedAtMs,
  startOfWeek, addDays, ymd,
} from './TasksBoardShared'

/**
 * Toda a derivação de estado (filtro, agrupamento, recorte de período,
 * grade da semana/mês) do TasksBoard — extraído só pra manter
 * TasksBoard.tsx dentro do limite de linhas do lint. Sem estado próprio,
 * só `useMemo`s puros sobre as props recebidas.
 */
export function useTasksBoardDerived({
  tasks, priority, assignee, statusFilter, relatedFilter, onlyMine, currentUserId, search,
  viewMode, listPeriod, selectedDay, todayOnly, calView, calMonth, weekAnchor,
}: {
  tasks: Task[]
  priority: PriorityFilter
  assignee: AssigneeFilter
  statusFilter: StatusFilter
  relatedFilter: RelatedFilter
  onlyMine: boolean
  currentUserId?: string
  search: string
  viewMode: ViewMode
  listPeriod: ListPeriod
  selectedDay: string | null
  todayOnly: boolean
  calView: CalView
  calMonth: Date
  weekAnchor: Date
}) {
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

  // No modo Lista, o recorte de período vem das abas Hoje/Esta semana/Este
  // mês/Todas (listPeriod) — não do calendário (que nem é exibido nesse
  // modo). No modo Calendário, o recorte segue o mês/semana visível, como
  // antes. Tarefas sem data ficam sempre visíveis (não têm período pra
  // pertencer), exceto na aba "Hoje" (mostraria tarefa nenhuma útil ali).
  const periodTasks = useMemo(() => {
    if (viewMode === 'list') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (listPeriod === 'all') return filtered
      if (listPeriod === 'today') {
        const t0 = todayISO()
        return filtered.filter(t => t.due_date && t.due_date.split('T')[0] === t0)
      }
      if (listPeriod === 'week') {
        const weekStart = startOfWeek(today)
        const weekEnd = addDays(weekStart, 6)
        return filtered.filter(t => {
          const d = dueDateOnly(t)
          if (!d) return true
          return d >= weekStart && d <= weekEnd
        })
      }
      // 'month'
      return filtered.filter(t => {
        const d = dueDateOnly(t)
        if (!d) return true
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
      })
    }

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
  }, [filtered, viewMode, listPeriod, selectedDay, todayOnly, calView, calMonth, weekAnchor])

  // Contagem do cabeçalho ("X atrasada · Y para hoje") — sempre sobre o
  // conjunto filtrado inteiro, independente do período/mês exibido no
  // momento (é um resumo geral, não um contador do recorte visível).
  const overdueCount = useMemo(() => filtered.filter(t => classify(t) === 'overdue').length, [filtered])
  const todayCount = useMemo(() => filtered.filter(t => classify(t) === 'today').length, [filtered])

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

  return { filtered, tasksByDate, overdueCount, todayCount, grouped }
}

/** Grade de dias visíveis + faixa de horas da timeline semanal + grade do mês. */
export function useTasksBoardGrid({
  weekAnchor, calMonth, tasksByDate,
}: {
  weekAnchor: Date
  calMonth: Date
  tasksByDate: Record<string, Task[]>
}) {
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

  return { weekDays, hours, monthDays, todayYmd: ymd(new Date()) }
}
