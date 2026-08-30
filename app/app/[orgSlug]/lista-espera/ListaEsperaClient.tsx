'use client'

import { useState } from 'react'
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
import { Plus, Pencil, Trash2, Hourglass, ShieldAlert } from 'lucide-react'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  type ClinicWaitlistRow, type ClinicWaitlistInput,
  createClinicWaitlistEntry, updateClinicWaitlistEntry, deleteClinicWaitlistEntry, setClinicWaitlistStatus,
} from '@/actions/clinic-waitlist'
import { CLINIC_WAITLIST_STATUSES, CLINIC_WAITLIST_STATUS_LABEL, type ClinicWaitlistStatus } from '@/lib/clinic-constants'

type Professional = { id: string; name: string }
type EventType = { id: string; name: string }

const STATUS_COLOR: Record<ClinicWaitlistStatus, string> = {
  aguardando: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  contatado: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  agendado: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  cancelado: 'bg-muted text-muted-foreground',
}

const EMPTY: ClinicWaitlistInput = {
  patient_contato_id: '', professional_id: null, event_type_id: null,
  preferred_from: null, preferred_until: null, preferred_time: null, notes: null,
}

export default function ListaEsperaClient({
  orgSlug, initialEntries, professionals, eventTypes,
}: {
  orgSlug: string
  initialEntries: ClinicWaitlistRow[]
  professionals: Professional[]
  eventTypes: EventType[]
}) {
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [patientLabel, setPatientLabel] = useState<{ id: string; name: string } | null>(null)
  const [draft, setDraft] = useState<ClinicWaitlistInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<ClinicWaitlistRow | null>(null)

  function refresh() { router.refresh() }

  function openNew() {
    setEditingId(null)
    setDraft(EMPTY)
    setPatientLabel(null)
    setDialogOpen(true)
  }

  function openEdit(row: ClinicWaitlistRow) {
    setEditingId(row.id)
    setPatientLabel({ id: row.patient_contato_id, name: row.patient_name })
    setDraft({
      patient_contato_id: row.patient_contato_id,
      professional_id: row.professional_id,
      event_type_id: row.event_type_id,
      preferred_from: row.preferred_from,
      preferred_until: row.preferred_until,
      preferred_time: row.preferred_time,
      notes: row.notes,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = editingId
      ? await updateClinicWaitlistEntry(orgSlug, editingId, draft)
      : await createClinicWaitlistEntry(orgSlug, draft)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(editingId ? 'Entrada atualizada' : 'Adicionado à lista de espera')
    setDialogOpen(false)
    refresh()
  }

  async function handleDelete(row: ClinicWaitlistRow) {
    const res = await deleteClinicWaitlistEntry(orgSlug, row.id)
    if (!res.ok) { toast.error(res.error); return }
    setEntries(prev => prev.filter(e => e.id !== row.id))
    toast.success('Removido da lista de espera')
  }

  async function handleStatus(row: ClinicWaitlistRow, status: ClinicWaitlistStatus) {
    const res = await setClinicWaitlistStatus(orgSlug, row.id, status)
    if (!res.ok) { toast.error(res.error); return }
    setEntries(prev => prev.map(e => (e.id === row.id ? { ...e, status } : e)))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {entries.length === 0 ? 'Nenhum paciente na lista de espera' : `${entries.length} entrada(s)`}
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Adicionar à lista</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Editar entrada' : 'Adicionar à lista de espera'}</DialogTitle></DialogHeader>
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
                  <Label>Profissional desejado</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.professional_id || ''}
                    onChange={e => setDraft({ ...draft, professional_id: e.target.value || null })}
                  >
                    <option value="">(Qualquer um)</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Serviço desejado</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.event_type_id || ''}
                    onChange={e => setDraft({ ...draft, event_type_id: e.target.value || null })}
                  >
                    <option value="">(Qualquer um)</option>
                    {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Período de — até</Label>
                  <Input type="date" value={draft.preferred_from || ''} onChange={e => setDraft({ ...draft, preferred_from: e.target.value || null })} />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Input type="date" value={draft.preferred_until || ''} onChange={e => setDraft({ ...draft, preferred_until: e.target.value || null })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Horário preferido</Label>
                <Input value={draft.preferred_time || ''} onChange={e => setDraft({ ...draft, preferred_time: e.target.value || null })} placeholder="Ex: manhã, após 18h..." />
              </div>

              <p className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Não digite diagnóstico ou outro dado de saúde sensível aqui — este registro não é prontuário médico.
              </p>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value || null })} placeholder="Ex.: prefere atendimento com a Dra. Ana, ligar antes de confirmar..." />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving || !draft.patient_contato_id}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <Hourglass className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum paciente na lista de espera.</p>
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{e.patient_name}</span>
                  <Badge variant="outline" className={STATUS_COLOR[e.status]}>{CLINIC_WAITLIST_STATUS_LABEL[e.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {e.professional_name || 'Qualquer profissional'}{e.service_name ? ` · ${e.service_name}` : ''}
                  {e.preferred_time ? ` · ${e.preferred_time}` : ''}
                  {e.preferred_from ? ` · a partir de ${new Date(e.preferred_from + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <select
                className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs"
                value={e.status}
                onChange={ev => handleStatus(e, ev.target.value as ClinicWaitlistStatus)}
              >
                {CLINIC_WAITLIST_STATUSES.map(s => <option key={s} value={s}>{CLINIC_WAITLIST_STATUS_LABEL[s]}</option>)}
              </select>
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(e)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da lista de espera?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete ? `Remover "${toDelete.patient_name}" da lista de espera? ` : ''}Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDelete(toDelete!); setToDelete(null) }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
