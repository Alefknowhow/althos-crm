'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, ClipboardList, ShieldAlert } from 'lucide-react'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  type ClinicAttendanceRow, type ClinicAttendanceInput,
  createClinicAttendance, updateClinicAttendance, deleteClinicAttendance,
} from '@/actions/clinic-attendances'

type Professional = { id: string; name: string }
type EventType = { id: string; name: string }

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY: ClinicAttendanceInput = {
  patient_contato_id: '', professional_id: null, event_type_id: null,
  attended_at: new Date().toISOString(), notes: null, recommendations: null, next_return_date: null,
  total_cents: null, discount_cents: 0, payment_method: null,
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro', boleto: 'Boleto', transferencia: 'Transferência',
}

export default function AtendimentosClient({
  orgSlug, initialAttendances, professionals, eventTypes,
}: {
  orgSlug: string
  initialAttendances: ClinicAttendanceRow[]
  professionals: Professional[]
  eventTypes: EventType[]
}) {
  const router = useRouter()
  const [attendances, setAttendances] = useState(initialAttendances)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [patientLabel, setPatientLabel] = useState<{ id: string; name: string } | null>(null)
  const [draft, setDraft] = useState<ClinicAttendanceInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<ClinicAttendanceRow | null>(null)

  function refresh() { router.refresh() }

  function openNew() {
    setEditingId(null)
    setDraft(EMPTY)
    setPatientLabel(null)
    setDialogOpen(true)
  }

  function openEdit(row: ClinicAttendanceRow) {
    setEditingId(row.id)
    setPatientLabel({ id: row.patient_contato_id, name: row.patient_name })
    setDraft({
      patient_contato_id: row.patient_contato_id,
      professional_id: row.professional_id,
      event_type_id: row.event_type_id,
      attended_at: row.attended_at,
      notes: row.notes,
      recommendations: row.recommendations,
      next_return_date: row.next_return_date,
      total_cents: row.total_cents,
      discount_cents: row.discount_cents,
      payment_method: row.payment_method,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = editingId
      ? await updateClinicAttendance(orgSlug, editingId, draft)
      : await createClinicAttendance(orgSlug, draft)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(editingId ? 'Atendimento atualizado' : 'Atendimento registrado')
    setDialogOpen(false)
    refresh()
  }

  async function handleDelete(row: ClinicAttendanceRow) {
    const res = await deleteClinicAttendance(orgSlug, row.id)
    if (!res.ok) { toast.error(res.error); return }
    setAttendances(prev => prev.filter(a => a.id !== row.id))
    toast.success('Atendimento excluído')
  }

  const totalRevenue = attendances.reduce((acc, a) => acc + Math.max(0, (a.total_cents || 0) - a.discount_cents), 0)
  const withValue = attendances.filter(a => a.total_cents != null)
  const avgTicket = withValue.length > 0 ? Math.round(totalRevenue / withValue.length) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Atendimentos (últimos 200)</p>
          <p className="text-lg font-semibold">{attendances.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Receita registrada</p>
          <p className="text-lg font-semibold">{fmtCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Ticket médio</p>
          <p className="text-lg font-semibold">{fmtCurrency(avgTicket)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {attendances.length === 0 ? 'Nenhum atendimento registrado ainda' : `${attendances.length} atendimento(s)`}
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Registrar atendimento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Editar atendimento' : 'Registrar atendimento'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <LeadCombobox
                  name="patient"
                  orgSlug={orgSlug}
                  defaultLead={patientLabel ? { id: patientLabel.id, name: patientLabel.name } : null}
                  onChange={lead => setDraft(d => ({ ...d, patient_contato_id: lead?.id || '' }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.professional_id || ''}
                    onChange={e => setDraft({ ...draft, professional_id: e.target.value || null })}
                  >
                    <option value="">(Nenhum)</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.event_type_id || ''}
                    onChange={e => setDraft({ ...draft, event_type_id: e.target.value || null })}
                  >
                    <option value="">(Nenhum)</option>
                    {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data/hora do atendimento</Label>
                  <Input
                    type="datetime-local"
                    value={toDatetimeLocal(draft.attended_at)}
                    onChange={e => setDraft({ ...draft, attended_at: new Date(e.target.value).toISOString() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Próximo retorno sugerido</Label>
                  <Input type="date" value={draft.next_return_date || ''} onChange={e => setDraft({ ...draft, next_return_date: e.target.value || null })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Valor cobrado</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={draft.total_cents != null ? (draft.total_cents / 100).toFixed(2) : ''}
                    onChange={e => setDraft({ ...draft, total_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={draft.discount_cents ? (draft.discount_cents / 100).toFixed(2) : ''}
                    onChange={e => setDraft({ ...draft, discount_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : 0 })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select value={draft.payment_method || 'none'} onValueChange={v => setDraft({ ...draft, payment_method: v === 'none' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {Object.entries(PAYMENT_METHOD_LABEL).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {draft.total_cents != null && (
                <p className="text-xs text-muted-foreground">
                  Líquido pra receita: <span className="font-medium text-foreground">{fmtCurrency(Math.max(0, draft.total_cents - (draft.discount_cents || 0)))}</span>
                </p>
              )}

              <p className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Não digite diagnóstico, prescrição ou outro dado de saúde sensível aqui — este registro não é prontuário médico.
              </p>

              <div className="space-y-2">
                <Label>Observações operacionais</Label>
                <Textarea rows={2} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value || null })} placeholder="Ex.: paciente chegou atrasado, pediu para remarcar..." />
              </div>

              <div className="space-y-2">
                <Label>Recomendações</Label>
                <Textarea rows={2} value={draft.recommendations || ''} onChange={e => setDraft({ ...draft, recommendations: e.target.value || null })} placeholder="Ex.: trazer exame na próxima visita, confirmar por WhatsApp..." />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving || !draft.patient_contato_id}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Registrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {attendances.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum atendimento registrado ainda.</p>
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {attendances.map(a => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{a.patient_name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.attended_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {a.professional_name || '—'}{a.service_name ? ` · ${a.service_name}` : ''}
                  {a.next_return_date ? ` · retorno sugerido: ${new Date(a.next_return_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              {a.total_cents != null && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{fmtCurrency(Math.max(0, a.total_cents - a.discount_cents))}</div>
                  {a.payment_method && (
                    <div className="text-[10px] text-muted-foreground">{PAYMENT_METHOD_LABEL[a.payment_method] || a.payment_method}</div>
                  )}
                </div>
              )}
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(a)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete ? `Excluir o registro de atendimento de "${toDelete.patient_name}"? ` : ''}Essa ação não pode ser desfeita.</AlertDialogDescription>
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
