'use client'

import { useEffect, useState } from 'react'
import { listTasksForSale, toggleTaskStatus, type SaleTaskRow } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { CheckSquare, Square, ListTodo } from 'lucide-react'

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}

export default function SaleTasksList({ orgSlug, saleId }: { orgSlug: string; saleId: string }) {
  const [tasks, setTasks] = useState<SaleTaskRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listTasksForSale(orgSlug, saleId).then(rows => { if (!cancelled) setTasks(rows) })
    return () => { cancelled = true }
  }, [orgSlug, saleId])

  async function handleToggle(task: SaleTaskRow) {
    setBusyId(task.id)
    const nextStatus = task.status === 'done' ? 'open' : 'done'
    const res = await toggleTaskStatus(orgSlug, task.id, nextStatus)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    setTasks(prev => prev?.map(t => t.id === task.id ? { ...t, status: nextStatus } : t) ?? null)
  }

  if (tasks === null) return null
  if (tasks.length === 0) return null

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <ListTodo className="w-3.5 h-3.5" /> Tarefas desta reserva
      </p>
      <ul className="space-y-1.5">
        {tasks.map(t => {
          const done = t.status === 'done'
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={busyId === t.id}
                onClick={() => handleToggle(t)}
                className="w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                {done ? <CheckSquare className="w-4 h-4 text-success shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className={cn('flex-1 min-w-0 truncate text-sm', done && 'line-through text-muted-foreground')}>{t.title}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(t.due_date)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
