'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck2, CheckSquare, X, Ban } from 'lucide-react'
import {
  type ClinicReturnRow, createClinicReturnTask, setClinicReturnStatus,
} from '@/actions/clinic-returns'

const STATUS_LABEL: Record<ClinicReturnRow['return_status'], string> = {
  pendente: 'Pendente',
  tarefa_criada: 'Tarefa criada',
  agendado: 'Agendado',
  dispensado: 'Dispensado',
}
const STATUS_COLOR: Record<ClinicReturnRow['return_status'], string> = {
  pendente: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  tarefa_criada: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  agendado: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  dispensado: 'bg-muted text-muted-foreground',
}

export default function RetornosClient({ orgSlug, initialReturns }: { orgSlug: string; initialReturns: ClinicReturnRow[] }) {
  const router = useRouter()
  const [returns, setReturns] = useState(initialReturns)
  const [busyId, setBusyId] = useState<string | null>(null)

  function refresh() { router.refresh() }

  async function handleCreateTask(row: ClinicReturnRow) {
    setBusyId(row.attendance_id)
    const res = await createClinicReturnTask(orgSlug, row.attendance_id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Tarefa de retorno criada')
    refresh()
  }

  async function handleStatus(row: ClinicReturnRow, status: 'agendado' | 'dispensado') {
    setBusyId(row.attendance_id)
    const res = await setClinicReturnStatus(orgSlug, row.attendance_id, status)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    setReturns(prev => prev.map(r => (r.attendance_id === row.attendance_id ? { ...r, return_status: status } : r)))
    toast.success('Status atualizado')
  }

  const pendentes = returns.filter(r => r.return_status === 'pendente')
  const outros = returns.filter(r => r.return_status !== 'pendente')

  function Row({ row }: { row: ClinicReturnRow }) {
    const overdue = new Date(row.next_return_date + 'T00:00:00') < new Date(new Date().toDateString())
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{row.patient_name}</span>
            <Badge variant="outline" className={STATUS_COLOR[row.return_status]}>{STATUS_LABEL[row.return_status]}</Badge>
            {overdue && row.return_status === 'pendente' && <Badge variant="destructive">Atrasado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {row.professional_name || '—'}{row.service_name ? ` · ${row.service_name}` : ''}
            {' · retorno sugerido: '}{new Date(row.next_return_date + 'T00:00:00').toLocaleDateString('pt-BR')}
          </p>
        </div>
        {row.return_status === 'pendente' && (
          <>
            <Button variant="outline" size="sm" disabled={busyId === row.attendance_id} onClick={() => handleCreateTask(row)}>
              <CheckSquare className="w-3.5 h-3.5 mr-1" /> Criar tarefa
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7" title="Já agendado" disabled={busyId === row.attendance_id} onClick={() => handleStatus(row, 'agendado')}>
              <CalendarCheck2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" title="Dispensar" disabled={busyId === row.attendance_id} onClick={() => handleStatus(row, 'dispensado')}>
              <Ban className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">{pendentes.length === 0 ? 'Nenhum retorno pendente' : `${pendentes.length} retorno(s) pendente(s)`}</p>
        {pendentes.length > 0 && (
          <div className="rounded-md border divide-y">
            {pendentes.map(r => <Row key={r.attendance_id} row={r} />)}
          </div>
        )}
      </div>

      {outros.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Já tratados</p>
          <div className="rounded-md border divide-y">
            {outros.map(r => <Row key={r.attendance_id} row={r} />)}
          </div>
        </div>
      )}

      {returns.length === 0 && (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <X className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum retorno sugerido ainda — defina &quot;próximo retorno&quot; ao registrar um atendimento.</p>
        </div>
      )}
    </div>
  )
}
