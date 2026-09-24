import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteTask, toggleTaskStatus, setTaskPriority } from '@/actions/tasks'
import { type Task } from './TasksBoardShared'

/**
 * Optimistic mutations for TasksBoard (lista). Split out of TasksBoard.tsx
 * — pure logic, no JSX. Sem drag-and-drop/timeline: isso é Agenda → Eventos
 * agora (components/features/agenda/eventos/useEventsCalendarMutations.ts).
 */
export function useTasksBoardMutations({
  orgSlug, setTasks, setEditing,
}: {
  orgSlug: string
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setEditing: (t: Task | null) => void
}) {
  const router = useRouter()

  async function handleToggleDone(task: Task) {
    const prevStatus = task.status
    const next = prevStatus === 'done' ? 'open' : 'done'
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: next } : t)))
    const res = await toggleTaskStatus(orgSlug, task.id, next)
    if (!res.ok) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: prevStatus } : t)))
      toast.error('Erro ao atualizar tarefa')
      return
    }
    // "Desfazer" só faz sentido pra quem acabou de concluir (não pra quem
    // reabriu uma tarefa) — reverte pro status anterior com a mesma
    // action optimista + chamada ao servidor.
    if (next === 'done') {
      toast.success('Tarefa concluída', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: prevStatus } : t)))
            // Este branch só roda quando `next === 'done'`, ou seja
            // `prevStatus` já era diferente de 'done' — sempre volta pra
            // 'open' (toggleTaskStatus só aceita open/done, sem 'doing').
            const undo = await toggleTaskStatus(orgSlug, task.id, 'open')
            if (!undo.ok) {
              setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: next } : t)))
              toast.error('Erro ao desfazer')
              return
            }
            router.refresh()
          },
        },
      })
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

  return { handleToggleDone, handleSetPriority, handleDelete }
}
