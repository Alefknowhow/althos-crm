'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Percent } from 'lucide-react'
import {
  type ClinicCommissionRow,
  createManualClinicCommission, setClinicCommissionStatus, deleteClinicCommission,
} from '@/actions/clinic-commissions'
import { CLINIC_COMMISSION_STATUSES, CLINIC_COMMISSION_SOURCE_LABEL, type ClinicCommissionStatus } from '@/lib/clinic-constants'

type Professional = { id: string; name: string }

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

const STATUS_COLOR: Record<ClinicCommissionStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  pago: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
}

const EMPTY = { professional_id: '', base_amount_cents: 0, commission_pct: 0, notes: '' as string | null }

export default function ComissoesClient({
  orgSlug, initialCommissions, professionals,
}: {
  orgSlug: string
  initialCommissions: ClinicCommissionRow[]
  professionals: Professional[]
}) {
  const router = useRouter()
  const [commissions, setCommissions] = useState(initialCommissions)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<ClinicCommissionRow | null>(null)
  const [professionalFilter, setProfessionalFilter] = useState<string>('')

  function refresh() { router.refresh() }

  const filtered = useMemo(
    () => (professionalFilter ? commissions.filter(c => c.professional_id === professionalFilter) : commissions),
    [commissions, professionalFilter],
  )
  const totalPendente = filtered.filter(c => c.status === 'pendente').reduce((a, c) => a + c.commission_cents, 0)
  const totalPago = filtered.filter(c => c.status === 'pago').reduce((a, c) => a + c.commission_cents, 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await createManualClinicCommission(orgSlug, {
      professional_id: draft.professional_id,
      base_amount_cents: draft.base_amount_cents,
      commission_pct: draft.commission_pct,
      notes: draft.notes,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Comissão registrada')
    setDialogOpen(false)
    setDraft(EMPTY)
    refresh()
  }

  async function handleDelete(row: ClinicCommissionRow) {
    const res = await deleteClinicCommission(orgSlug, row.id)
    if (!res.ok) { toast.error(res.error); return }
    setCommissions(prev => prev.filter(c => c.id !== row.id))
    toast.success('Comissão excluída')
  }

  async function handleStatus(row: ClinicCommissionRow, status: ClinicCommissionStatus) {
    const res = await setClinicCommissionStatus(orgSlug, row.id, status)
    if (!res.ok) { toast.error(res.error); return }
    setCommissions(prev => prev.map(c => (c.id === row.id ? { ...c, status } : c)))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="text-lg font-bold tabular-nums">{fmtCurrency(totalPendente)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Pago</p>
          <p className="text-lg font-bold tabular-nums">{fmtCurrency(totalPago)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <select
          className="h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
          value={professionalFilter}
          onChange={e => setProfessionalFilter(e.target.value)}
        >
          <option value="">Todos os profissionais</option>
          {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDraft(EMPTY)}><Plus className="w-4 h-4 mr-1" /> Comissão manual</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Registrar comissão manual</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Profissional *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                  value={draft.professional_id}
                  onChange={e => setDraft({ ...draft, professional_id: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor base (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={draft.base_amount_cents / 100} onChange={e => setDraft({ ...draft, base_amount_cents: Math.round((Number(e.target.value) || 0) * 100) })} />
                </div>
                <div className="space-y-2">
                  <Label>Percentual (%)</Label>
                  <Input type="number" min={0} max={100} step="0.01" value={draft.commission_pct} onChange={e => setDraft({ ...draft, commission_pct: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Comissão calculada: {fmtCurrency(Math.round((draft.base_amount_cents * draft.commission_pct) / 100))}
              </p>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value || null })} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving || !draft.professional_id}>{saving ? 'Salvando...' : 'Registrar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <Percent className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma comissão registrada ainda.</p>
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{c.professional_name}</span>
                  <Badge variant="outline" className={STATUS_COLOR[c.status]}>{c.status === 'pago' ? 'Pago' : 'Pendente'}</Badge>
                  <Badge variant="outline">{CLINIC_COMMISSION_SOURCE_LABEL[c.source_type]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {c.patient_name ? `${c.patient_name} · ` : ''}
                  base {fmtCurrency(c.base_amount_cents)} × {c.commission_pct}% = <span className="font-medium">{fmtCurrency(c.commission_cents)}</span>
                  {' · '}{new Date(c.competencia + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              <select
                className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs"
                value={c.status}
                onChange={e => handleStatus(c, e.target.value as ClinicCommissionStatus)}
              >
                {CLINIC_COMMISSION_STATUSES.map(s => <option key={s} value={s}>{s === 'pago' ? 'Pago' : 'Pendente'}</option>)}
              </select>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comissão?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete ? `Excluir a comissão de "${toDelete.professional_name}"? ` : ''}Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDelete(toDelete!); setToDelete(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
