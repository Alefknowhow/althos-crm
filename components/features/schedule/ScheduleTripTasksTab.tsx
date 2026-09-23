'use client'

/**
 * Conteúdo da aba "Tarefas" do painel de detalhe de Embarques — permite
 * gerenciar direto dali (marcar concluída, excluir, criar uma nova) em vez
 * de só listar e mandar pro módulo de Tarefas. Extraído de
 * ScheduleTripDetailTabs.tsx pra isolar o estado/as mutações.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CheckSquare, Circle, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  createTask, deleteTask, listTasksForSale, toggleTaskStatus, type SaleTaskRow,
} from '@/actions/tasks-crud'

function isDone(status: string) {
  return status === 'done' || status === 'completed'
}

export function ScheduleTripTasksTab({
  orgSlug, saleId, tasks, loading, onTasksChange,
}: {
  orgSlug: string
  saleId: string
  tasks: SaleTaskRow[]
  loading: boolean
  onTasksChange: (tasks: SaleTaskRow[]) => void
}) {
  const [newTitle, setNewTitle] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // A reserva selecionada pode mudar (usuário fecha o painel e abre outra
  // viagem) enquanto uma mutação ainda está em voo — guarda a reserva "dona"
  // de cada chamada e descarta a resposta se ela não bater mais com a atual
  // quando voltar, pra não vazar dado de uma reserva pra outra.
  const saleIdRef = useRef(saleId)
  useEffect(() => { saleIdRef.current = saleId }, [saleId])

  async function toggle(task: SaleTaskRow) {
    const sid = saleId
    const nextStatus = isDone(task.status) ? 'open' : 'done'
    setBusyId(task.id)
    onTasksChange(tasks.map(t => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    try {
      const res = await toggleTaskStatus(orgSlug, task.id, nextStatus)
      if (saleIdRef.current !== sid) return
      if (!res.ok) {
        toast.error('Não foi possível atualizar a tarefa.')
        onTasksChange(tasks.map(t => (t.id === task.id ? { ...t, status: task.status } : t)))
      }
    } catch {
      if (saleIdRef.current !== sid) return
      toast.error('Não foi possível atualizar a tarefa.')
      onTasksChange(tasks.map(t => (t.id === task.id ? { ...t, status: task.status } : t)))
    } finally {
      if (saleIdRef.current === sid) setBusyId(null)
    }
  }

  async function remove(task: SaleTaskRow) {
    const sid = saleId
    const previous = tasks
    setBusyId(task.id)
    onTasksChange(tasks.filter(t => t.id !== task.id))
    try {
      const res = await deleteTask(orgSlug, task.id)
      if (saleIdRef.current !== sid) return
      if (!res.ok) {
        toast.error('Não foi possível excluir a tarefa.')
        onTasksChange(previous)
      }
    } catch {
      if (saleIdRef.current !== sid) return
      toast.error('Não foi possível excluir a tarefa.')
      onTasksChange(previous)
    } finally {
      if (saleIdRef.current === sid) setBusyId(null)
    }
  }

  async function add() {
    const title = newTitle.trim()
    if (!title || creating) return
    const sid = saleId
    setCreating(true)
    try {
      const res = await createTask(orgSlug, { title, sale_id: sid })
      if (!res.ok) { toast.error(res.error || 'Não foi possível criar a tarefa.'); return }
      // createTask não devolve o id da linha criada — recarrega a lista da
      // reserva pra pegar a tarefa nova com id de verdade.
      const fresh = await listTasksForSale(orgSlug, sid)
      if (saleIdRef.current !== sid) return
      setNewTitle('')
      onTasksChange(fresh)
    } catch {
      if (saleIdRef.current === sid) toast.error('Não foi possível criar a tarefa.')
    } finally {
      if (saleIdRef.current === sid) setCreating(false)
    }
  }

  const done = tasks.filter(t => isDone(t.status)).length
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckSquare className="w-4 h-4 text-primary" /> Checklist de embarque
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        {tasks.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">{done} de {tasks.length}</span>
        )}
      </div>
      {tasks.length > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {!loading && tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-3">Nenhuma tarefa vinculada a esta reserva.</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {tasks.map(t => {
            const taskDone = isDone(t.status)
            const busy = busyId === t.id
            return (
              <li key={t.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm group">
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  disabled={busy}
                  className="mt-0.5 shrink-0 disabled:opacity-50"
                  aria-label={taskDone ? 'Marcar como pendente' : 'Marcar como concluída'}
                >
                  {taskDone
                    ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                    : <Circle className="w-4 h-4 text-muted-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate', taskDone && 'line-through text-muted-foreground')}>{t.title || 'Tarefa'}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {t.due_date && (
                      <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString('pt-BR')}</span>
                    )}
                    {t.priority === 'high' && !taskDone && (
                      <span className="text-[10px] font-medium px-1.5 py-0 rounded-full bg-destructive/15 text-destructive">Alta prioridade</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  disabled={busy}
                  className={cn(
                    'shrink-0 text-muted-foreground hover:text-destructive transition-opacity disabled:opacity-50',
                    'opacity-100 focus-visible:opacity-100 focus-visible:outline-none',
                    '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100',
                  )}
                  aria-label="Excluir tarefa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !creating) add() }}
          placeholder="Nova tarefa para esta reserva…"
          className="h-9 text-sm"
          disabled={creating}
        />
        <Button type="button" size="sm" onClick={add} disabled={creating || !newTitle.trim()}>
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <Button size="sm" variant="ghost" className="w-fit" asChild>
        <Link href={`/app/${orgSlug}/tarefas`}>Ver todas as tarefas</Link>
      </Button>
    </div>
  )
}
