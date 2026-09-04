'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Plane } from 'lucide-react'
import { createTravelBlock, updateTravelBlock, type TravelBlockRow } from '@/actions/travel-blocks'

const EMPTY_FORM = {
  origem: '', destino: '', data_ida: '', data_volta: '',
  voo_ida: '', horario_ida: '', voo_volta: '', horario_volta: '',
  assentos_total: '', assentos_disponiveis: '', prazo: '', observacoes: '',
}

type FormState = typeof EMPTY_FORM

function blockToForm(b: TravelBlockRow): FormState {
  return {
    origem: b.origem, destino: b.destino,
    data_ida: b.data_ida || '', data_volta: b.data_volta || '',
    voo_ida: b.voo_ida || '', horario_ida: b.horario_ida || '',
    voo_volta: b.voo_volta || '', horario_volta: b.horario_volta || '',
    assentos_total: b.assentos_total != null ? String(b.assentos_total) : '',
    assentos_disponiveis: String(b.assentos_disponiveis),
    prazo: b.prazo || '', observacoes: b.observacoes || '',
  }
}

function formToPatch(f: FormState): Record<string, any> {
  return {
    origem: f.origem, destino: f.destino,
    data_ida: f.data_ida, data_volta: f.data_volta || null,
    voo_ida: f.voo_ida.trim() || null, horario_ida: f.horario_ida.trim() || null,
    voo_volta: f.voo_volta.trim() || null, horario_volta: f.horario_volta.trim() || null,
    assentos_total: f.assentos_total ? parseInt(f.assentos_total) : null,
    assentos_disponiveis: f.assentos_disponiveis ? parseInt(f.assentos_disponiveis) : 0,
    prazo: f.prazo || null, observacoes: f.observacoes.trim() || null,
  }
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

/** Create/edit dialog for a travel block. Split out of BlocksView.tsx. */
export function BlockDialog({
  orgSlug, editing, onClose, onSaved,
}: {
  orgSlug: string
  editing: TravelBlockRow | 'new' | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = editing === 'new'
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [openedFor, setOpenedFor] = useState<string | null>(null)

  // Re-seed the form whenever the dialog opens for a different target.
  const key = editing === null ? null : isNew ? 'new' : editing.id
  if (key !== openedFor) {
    setOpenedFor(key)
    if (editing && editing !== 'new') setForm(blockToForm(editing))
    else setForm(EMPTY_FORM)
  }

  const set = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSave() {
    if (!form.origem.trim() || !form.destino.trim()) { toast.error('Informe origem e destino.'); return }
    if (!form.data_ida) { toast.error('Informe a data de ida.'); return }
    setSaving(true)
    const patch = formToPatch(form)
    const res = isNew
      ? await createTravelBlock(orgSlug, patch)
      : await updateTravelBlock(orgSlug, (editing as TravelBlockRow).id, patch)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(isNew ? 'Bloqueio criado' : 'Bloqueio salvo')
    onSaved()
  }

  return (
    <Dialog open={editing !== null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" /> {isNew ? 'Novo bloqueio' : 'Editar bloqueio'}
          </DialogTitle>
          <DialogDescription>
            Lote de assentos garantido com a operadora — o prazo é a data limite de devolução (release).
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={<>Origem <span className="text-destructive">*</span></>}>
            <Input value={form.origem} onChange={e => set('origem', e.target.value.toUpperCase())} placeholder="GYN" maxLength={5} />
          </Field>
          <Field label={<>Destino <span className="text-destructive">*</span></>}>
            <Input value={form.destino} onChange={e => set('destino', e.target.value.toUpperCase())} placeholder="FOR" maxLength={5} />
          </Field>
          <Field label={<>Data de ida <span className="text-destructive">*</span></>}>
            <Input type="date" value={form.data_ida} onChange={e => set('data_ida', e.target.value)} />
          </Field>
          <Field label="Data de volta">
            <Input type="date" value={form.data_volta} onChange={e => set('data_volta', e.target.value)} />
          </Field>
          <Field label="Voo ida">
            <Input value={form.voo_ida} onChange={e => set('voo_ida', e.target.value)} placeholder="4185/2932" />
          </Field>
          <Field label="Horário ida">
            <Input value={form.horario_ida} onChange={e => set('horario_ida', e.target.value)} placeholder="19:25/01:40" />
          </Field>
          <Field label="Voo volta">
            <Input value={form.voo_volta} onChange={e => set('voo_volta', e.target.value)} placeholder="2553/4227" />
          </Field>
          <Field label="Horário volta">
            <Input value={form.horario_volta} onChange={e => set('horario_volta', e.target.value)} placeholder="11:25/18:45" />
          </Field>
          <Field label="Assentos totais">
            <Input type="number" min="0" value={form.assentos_total} onChange={e => set('assentos_total', e.target.value)} placeholder="10" />
          </Field>
          <Field label="Assentos disponíveis">
            <Input type="number" min="0" value={form.assentos_disponiveis} onChange={e => set('assentos_disponiveis', e.target.value)} placeholder="10" />
          </Field>
          <Field label="Prazo (release)">
            <Input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} />
          </Field>
        </div>
        <Field label="Observações">
          <Textarea rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
        </Field>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={handleSave}>{saving ? 'Salvando…' : isNew ? 'Criar bloqueio' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
