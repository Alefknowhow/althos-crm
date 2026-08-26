'use client'

import { useEffect, useState } from 'react'
import { listTasksForSale, toggleTaskStatus, deleteTask, type SaleTaskRow } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckSquare, Square, ListTodo, Sparkles, Plus, Trash2 } from 'lucide-react'
import TaskDialog from '@/components/features/TaskDialog'
import SuggestedTasksDialog from '@/components/features/reservas/SuggestedTasksDialog'

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}

const KIND_LABELS: Record<string, string> = {
  aereo: 'Aéreo', hospedagem: 'Hospedagem', transfer: 'Transfer', cruzeiro: 'Cruzeiro',
  passeio: 'Passeio', seguro: 'Seguro', ingresso: 'Ingresso', veiculo: 'Veículo', outro: 'Outro',
}

export default function SaleTasksList({
  orgSlug, saleId, clientId, clientName, compact = false, limit,
}: {
  orgSlug: string
  saleId: string
  clientId?: string | null
  clientName?: string | null
  /** Modo resumido (usado na aba Visão geral) — sem ações de gerar/excluir. */
  compact?: boolean
  limit?: number
}) {
  const [tasks, setTasks] = useState<SaleTaskRow[] | null>(null)
  const [productKindById, setProductKindById] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)

  async function reload() {
    const rows = await listTasksForSale(orgSlug, saleId)
    setTasks(rows)
  }

  useEffect(() => {
    let cancelled = false
    reload().then(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, saleId])

  useEffect(() => {
    let cancelled = false
    import('@/actions/sale-products').then(({ listSaleProducts }) => {
      listSaleProducts(orgSlug, saleId).then(products => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const p of products) map[p.id] = p.kind
        setProductKindById(map)
      })
    })
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

  async function handleDelete(id: string) {
    setTasks(prev => prev?.filter(t => t.id !== id) ?? null)
    const res = await deleteTask(orgSlug, id)
    if (!res.ok) { toast.error('Erro ao excluir tarefa'); reload() }
  }

  if (tasks === null) {
    return <div className="text-xs text-muted-foreground py-3">Carregando tarefas…</div>
  }

  const shown = limit ? tasks.slice(0, limit) : tasks
  const pending = tasks.filter(t => t.status !== 'done').length

  if (tasks.length === 0) {
    if (compact) return <p className="text-xs text-muted-foreground">Nenhuma tarefa vinculada.</p>
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-center space-y-2">
        <ListTodo className="w-5 h-5 mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Nenhuma tarefa criada.</p>
        <div className="flex items-center justify-center gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Gerar tarefas
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova tarefa
          </Button>
        </div>
        <SuggestedTasksDialog orgSlug={orgSlug} saleId={saleId} open={suggestOpen} onOpenChange={setSuggestOpen} onGenerated={reload} />
        <TaskDialog
          orgSlug={orgSlug}
          saleId={saleId}
          defaultLead={clientId ? { id: clientId, name: clientName || '' } : null}
          trigger={<button type="button" className="hidden" aria-hidden />}
          open={newTaskOpen}
          onOpenChange={o => { setNewTaskOpen(o); if (!o) reload() }}
        />
      </div>
    )
  }

  return (
    <div className={cn(!compact && 'rounded-lg border bg-muted/20 p-3', 'space-y-2')}>
      {!compact && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ListTodo className="w-3.5 h-3.5" /> Tarefas · {pending} pendente{pending !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSuggestOpen(true)}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Gerar tarefas
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewTaskOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
            </Button>
          </div>
        </div>
      )}
      <ul className="space-y-1.5">
        {shown.map(t => {
          const done = t.status === 'done'
          const kind = t.source_product_id ? productKindById[t.source_product_id] : null
          return (
            <li key={t.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
              <button
                type="button"
                disabled={busyId === t.id}
                onClick={() => handleToggle(t)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {done ? <CheckSquare className="w-4 h-4 text-success shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className={cn('block truncate text-sm', done && 'line-through text-muted-foreground')}>{t.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {kind ? `Gerada automaticamente • ${KIND_LABELS[kind] || kind}` : 'Criada manualmente'}
                  </span>
                </div>
              </button>
              <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(t.due_date)}</span>
              {!compact && (
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="shrink-0 text-muted-foreground/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Excluir tarefa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <SuggestedTasksDialog orgSlug={orgSlug} saleId={saleId} open={suggestOpen} onOpenChange={setSuggestOpen} onGenerated={reload} />
      <TaskDialog
        orgSlug={orgSlug}
        saleId={saleId}
        defaultLead={clientId ? { id: clientId, name: clientName || '' } : null}
        trigger={<button type="button" className="hidden" aria-hidden />}
        open={newTaskOpen}
        onOpenChange={o => { setNewTaskOpen(o); if (!o) reload() }}
      />
    </div>
  )
}
