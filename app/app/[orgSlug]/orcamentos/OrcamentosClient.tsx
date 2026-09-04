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
import { Plus, Pencil, Trash2, X, FileText } from 'lucide-react'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  type ClinicQuoteListRow, type ClinicQuoteInput, type ClinicQuoteItemInput,
  createClinicQuote, updateClinicQuote, deleteClinicQuote, getClinicQuote, setClinicQuoteStatus,
} from '@/actions/clinic-quotes'
import { CLINIC_QUOTE_STATUSES, type ClinicQuoteStatus } from '@/lib/clinic-constants'

type Professional = { id: string; name: string }
type EventType = { id: string; name: string; duration_minutes: number }

const STATUS_LABEL: Record<ClinicQuoteStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  visualizado: 'Visualizado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
}
const STATUS_COLOR: Record<ClinicQuoteStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  enviado: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  visualizado: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
  aprovado: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  recusado: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  expirado: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  cancelado: 'bg-muted text-muted-foreground',
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

const EMPTY_ITEM: ClinicQuoteItemInput = { event_type_id: null, description: '', quantity: 1, unit_price_cents: 0 }
const EMPTY_QUOTE: ClinicQuoteInput = {
  patient_contato_id: '', professional_id: null, valid_until: null, discount_cents: 0, notes: null, items: [{ ...EMPTY_ITEM }],
}

export default function OrcamentosClient({
  orgSlug, initialQuotes, professionals, eventTypes: _eventTypes,
}: {
  orgSlug: string
  initialQuotes: ClinicQuoteListRow[]
  professionals: Professional[]
  eventTypes: EventType[]
}) {
  const router = useRouter()
  const [quotes, setQuotes] = useState(initialQuotes)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [patientLabel, setPatientLabel] = useState<{ id: string; name: string } | null>(null)
  const [draft, setDraft] = useState<ClinicQuoteInput>(EMPTY_QUOTE)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<ClinicQuoteListRow | null>(null)

  const professionalName = (id: string | null) => professionals.find(p => p.id === id)?.name || '—'

  function refresh() { router.refresh() }

  function openNew() {
    setEditingId(null)
    setDraft(EMPTY_QUOTE)
    setPatientLabel(null)
    setDialogOpen(true)
  }

  async function openEdit(row: ClinicQuoteListRow) {
    const full = await getClinicQuote(orgSlug, row.id)
    if (!full) { toast.error('Orçamento não encontrado'); return }
    setEditingId(row.id)
    setPatientLabel({ id: full.patient_contato_id, name: full.patient_name })
    setDraft({
      patient_contato_id: full.patient_contato_id,
      professional_id: full.professional_id,
      valid_until: full.valid_until,
      discount_cents: full.discount_cents,
      notes: full.notes,
      items: full.items.map(it => ({ ...it })),
    })
    setDialogOpen(true)
  }

  function updateItem(idx: number, patch: Partial<ClinicQuoteItemInput>) {
    setDraft(d => ({ ...d, items: d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }))
  }
  function addItem() {
    setDraft(d => ({ ...d, items: [...d.items, { ...EMPTY_ITEM }] }))
  }
  function removeItem(idx: number) {
    setDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))
  }

  const draftTotal = draft.items.reduce((a, it) => a + it.quantity * it.unit_price_cents, 0) - (draft.discount_cents || 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = editingId
      ? await updateClinicQuote(orgSlug, editingId, draft)
      : await createClinicQuote(orgSlug, draft)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(editingId ? 'Orçamento atualizado' : 'Orçamento criado')
    setDialogOpen(false)
    refresh()
  }

  async function handleDelete(row: ClinicQuoteListRow) {
    const res = await deleteClinicQuote(orgSlug, row.id)
    if (!res.ok) { toast.error(res.error); return }
    setQuotes(prev => prev.filter(q => q.id !== row.id))
    toast.success('Orçamento excluído')
  }

  async function handleStatusChange(row: ClinicQuoteListRow, status: ClinicQuoteStatus) {
    const res = await setClinicQuoteStatus(orgSlug, row.id, status)
    if (!res.ok) { toast.error(res.error); return }
    setQuotes(prev => prev.map(q => (q.id === row.id ? { ...q, status } : q)))
    toast.success('Status atualizado')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {quotes.length === 0 ? 'Nenhum orçamento criado ainda' : `${quotes.length} orçamento(s)`}
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo orçamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Editar orçamento' : 'Novo orçamento'}</DialogTitle></DialogHeader>
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
                  <Label>Válido até</Label>
                  <Input type="date" value={draft.valid_until || ''} onChange={e => setDraft({ ...draft, valid_until: e.target.value || null })} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Itens *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {draft.items.map((it, idx) => (
                    <div key={idx} className="flex items-end gap-2 rounded-md border p-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          value={it.description}
                          onChange={e => updateItem(idx, { description: e.target.value })}
                          placeholder="Ex: Avaliação inicial"
                          required
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input type="number" min={1} value={it.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 1 })} />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">Valor unit. (R$)</Label>
                        <Input
                          type="number" min={0} step="0.01"
                          value={it.unit_price_cents / 100}
                          onChange={e => updateItem(idx, { unit_price_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="w-8 h-8 text-destructive shrink-0" onClick={() => removeItem(idx)} disabled={draft.items.length === 1}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-2">
                  <Label>Desconto (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={(draft.discount_cents || 0) / 100}
                    onChange={e => setDraft({ ...draft, discount_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold tabular-nums">{fmtCurrency(draftTotal)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value || null })} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving || !draft.patient_contato_id}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum orçamento criado ainda.</p>
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {quotes.map(q => (
            <div key={q.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{q.patient_name}</span>
                  <Badge variant="outline" className={STATUS_COLOR[q.status]}>{STATUS_LABEL[q.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {professionalName(q.professional_id)} · {fmtCurrency(q.total_cents)}
                  {q.valid_until ? ` · válido até ${new Date(q.valid_until + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <select
                className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs"
                value={q.status}
                onChange={e => handleStatusChange(q, e.target.value as ClinicQuoteStatus)}
              >
                {CLINIC_QUOTE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(q)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(q)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete ? `Excluir o orçamento de "${toDelete.patient_name}"? ` : ''}Essa ação não pode ser desfeita.</AlertDialogDescription>
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
