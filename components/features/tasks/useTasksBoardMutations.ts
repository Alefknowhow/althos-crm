import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateTask, deleteTask, toggleTaskStatus, setTaskPriority } from '@/actions/tasks'
import { dueTimeOnly, combineDueDate, ROW_H, type Task } from './TasksBoardShared'

/**
 * Optimistic mutations + drag-and-drop handlers for TasksBoard. Split
 * out of TasksBoard.tsx — pure logic, no JSX.
 */
export function useTasksBoardMutations({
  orgSlug, tasks, setTasks, setEditing, setOpenPopoverId,
}: {
  orgSlug: string
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setEditing: (t: Task | null) => void
  setOpenPopoverId: (id: string | null) => void
}) {
  const router = useRouter()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

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

  return {
    dragOverKey, setDragOverKey,
    handleToggleDone, handleSetPriority, handleSetDueDate, handleDelete,
    onChipDragStart, onChipDragEnd,
    handleDropOnDay, handleDropOnSlot, handleDropOnAllDay,
  }
}
