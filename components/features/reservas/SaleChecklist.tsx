'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toggleSaleChecklistStep, type ChecklistStep, type TravelSaleRow } from '@/actions/travel-sales'
import { createTask } from '@/actions/tasks'
import { toast } from 'sonner'
import { Check, ListTodo } from 'lucide-react'

const STEPS: { key: ChecklistStep; label: string }[] = [
  { key: 'contrato_assinado', label: 'Contrato assinado' },
  { key: 'pagamento_confirmado', label: 'Pagamento confirmado' },
  { key: 'voucher_entregue', label: 'Voucher entregue' },
  { key: 'documentacao_enviada', label: 'Documentação enviada' },
  { key: 'embarque_realizado', label: 'Embarque realizado' },
  { key: 'posvenda_concluido', label: 'Pós-venda concluído' },
]

export default function SaleChecklist({ orgSlug, sale }: { orgSlug: string; sale: TravelSaleRow }) {
  const router = useRouter()
  const [busyStep, setBusyStep] = useState<ChecklistStep | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)

  const allSteps = [
    { key: 'venda_registrada' as const, label: 'Venda registrada', done: true, fixed: true },
    { key: 'contrato_gerado' as const, label: 'Contrato gerado', done: !!sale.contrato_gerado_at, fixed: true },
    ...STEPS.map(s => ({ ...s, done: !!sale[`${s.key}_at` as keyof TravelSaleRow], fixed: false })),
  ]

  const nextPending = allSteps.find(s => !s.done)

  async function handleToggle(step: ChecklistStep, done: boolean) {
    setBusyStep(step)
    const res = await toggleSaleChecklistStep(orgSlug, sale.id, step, done)
    setBusyStep(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  async function handleCreateTaskForNext() {
    if (!nextPending) return
    setCreatingTask(true)
    const res = await createTask(orgSlug, {
      title: `Etapa: ${nextPending.label} — ${sale.client_name || 'venda'}`,
      due_date: new Date().toISOString().slice(0, 10),
      priority: 'normal',
      contato_id: sale.contato_id || undefined,
    } as any)
    setCreatingTask(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Tarefa criada')
    router.refresh()
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ListTodo className="w-3.5 h-3.5" /> Checklist da venda
        </p>
        {nextPending ? (
          <Badge variant="warning" className="text-[10px] px-1.5 py-0">Próxima etapa: {nextPending.label}</Badge>
        ) : (
          <Badge variant="success" className="text-[10px] px-1.5 py-0">Todas as etapas concluídas</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {allSteps.map(s => (
          <button
            key={s.key}
            type="button"
            disabled={s.fixed || busyStep === s.key}
            onClick={() => !s.fixed && handleToggle(s.key as ChecklistStep, !s.done)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              s.done
                ? 'bg-success/15 text-success border-success/30'
                : 'bg-background hover:bg-muted text-muted-foreground border-border',
              s.fixed && 'cursor-default',
            )}
            title={s.fixed ? undefined : (s.done ? 'Clique para desmarcar' : 'Clique para marcar como concluída')}
          >
            {s.done && <Check className="w-3.5 h-3.5" />}
            {s.label}
          </button>
        ))}
      </div>

      {nextPending && (
        <Button type="button" variant="outline" size="sm" disabled={creatingTask} onClick={handleCreateTaskForNext}>
          {creatingTask ? 'Criando…' : `Criar tarefa para "${nextPending.label}"`}
        </Button>
      )}
    </div>
  )
}
