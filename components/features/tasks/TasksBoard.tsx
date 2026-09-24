'use client'

/**
 * TasksBoard — só lista, agrupada por status (Atrasadas/Hoje/Próximas/
 * Concluídas). O calendário "estilo Google Agenda" saiu daqui: virou
 * Agenda → Eventos (components/features/agenda/eventos/), com sua própria
 * base de dados (events) — Tarefas não marca esse calendário, e Eventos não
 * aparece aqui (separação pedida explicitamente, set/2026).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaskDialog from '@/components/features/TaskDialog'
import {
  type Member, type Task, type PriorityFilter, type AssigneeFilter, type GroupId,
  type StatusFilter, type RelatedFilter, type ListPeriod,
  EXPANDED_STORAGE_KEY, DEFAULT_EXPANDED, ymd,
} from './TasksBoardShared'
import { EditSheet } from './TasksBoardTaskViews'
import { TasksBoardToolbar } from './TasksBoardToolbar'
import { TasksBoardListPanel } from './TasksBoardListPanel'
import { useTasksBoardMutations } from './useTasksBoardMutations'
import { useTasksBoardDerived } from './useTasksBoardDerived'

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

  const [listPeriod, setListPeriod] = useState<ListPeriod>('today')
  const [quickAdd, setQuickAdd] = useState<{ date: string; time?: string } | null>(null)

  const {
    handleToggleDone, handleSetPriority, handleDelete,
  } = useTasksBoardMutations({ orgSlug, setTasks, setEditing })

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

  const { overdueCount, todayCount, grouped } = useTasksBoardDerived({
    tasks, priority, assignee, statusFilter, relatedFilter, onlyMine, currentUserId, search, listPeriod,
  })

  return (
    <div className="space-y-4">
      <TasksBoardToolbar
        search={search} setSearch={setSearch}
        currentUserId={currentUserId}
        onlyMine={onlyMine} setOnlyMine={setOnlyMine}
        onNewTask={() => setQuickAdd({ date: ymd(new Date()) })}
        members={members}
        assignee={assignee} setAssignee={setAssignee}
        priority={priority} setPriority={setPriority}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        relatedFilter={relatedFilter} setRelatedFilter={setRelatedFilter}
        niche={niche}
        listPeriod={listPeriod} setListPeriod={setListPeriod}
        overdueCount={overdueCount} todayCount={todayCount}
      />

      <TasksBoardListPanel
        orgSlug={orgSlug}
        members={members}
        listPeriod={listPeriod}
        grouped={grouped}
        expanded={expanded}
        toggleGroup={toggleGroup}
        onOpenFromList={setEditing}
        onToggleDone={handleToggleDone}
        onSetPriority={handleSetPriority}
        onDelete={handleDelete}
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
    </div>
  )
}
