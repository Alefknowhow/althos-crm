'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import EmptyState from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import {
  createTravelBlock, updateTravelBlock, deleteTravelBlock, type TravelBlockRow,
} from '@/actions/travel-blocks'
import { toast } from 'sonner'
import { Plane, Plus, Trash2, Search, Pencil, Minus } from 'lucide-react'

function fmtDate(d?: string | null) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—' }

function monthLabel(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' })
}

/** Prazo (release) status: vencido, próximo (≤7 dias) ou ok. */
function prazoStatus(prazo: string | null): 'vencido' | 'proximo' | 'ok' | null {
  if (!prazo) return null
  const today = new Date().toISOString().slice(0, 10)
  if (prazo < today) return 'vencido'
  const limit = new Date(); limit.setDate(limit.getDate() + 7)
  if (prazo <= limit.toISOString().slice(0, 10)) return 'proximo'
  return 'ok'
}

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

export default function BlocksView({
  orgSlug, blocks,
}: {
  orgSlug: string
  blocks: TravelBlockRow[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [destinoFilter, setDestinoFilter] = useState('all')
  const [editing, setEditing] = useState<TravelBlockRow | 'new' | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const destinos = useMemo(
    () => Array.from(new Set(blocks.map(b => b.destino))).sort(),
    [blocks],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return blocks.filter(b => {
      if (destinoFilter !== 'all' && b.destino !== destinoFilter) return false
      if (q) {
        const hay = [b.origem, b.destino, b.voo_ida, b.voo_volta, b.observacoes].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [blocks, query, destinoFilter])

  async function handleSeatDelta(b: TravelBlockRow, delta: number) {
    const next = Math.max(0, b.assentos_disponiveis + delta)
    const res = await updateTravelBlock(orgSlug, b.id, { assentos_disponiveis: next })
    if (res.ok) router.refresh()
    else toast.error(res.error)
  }

  async function handleDelete(id: string) {
    const res = await deleteTravelBlock(orgSlug, id)
    if (res.ok) { toast.success('Bloqueio excluído'); router.refresh() }
    else toast.error(res.error)
  }

  if (blocks.length === 0) {
    return (
      <>
        <div className="flex items-center justify-end mb-4">
          <Button onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo bloqueio
          </Button>
        </div>
        <EmptyState
          icon={Plane}
          title="Nenhum bloqueio cadastrado"
          description="Cadastre os lotes de assentos garantidos com a operadora — trecho, datas, voos, assentos disponíveis e prazo de release."
        />
        <BlockDialog orgSlug={orgSlug} editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh() }} />
      </>
    )
  }

  return (
    <>
      {/* Filtros — uma linha só, mesmo padrão das outras telas. */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por trecho, voo…" className="pl-8 h-9" />
        </div>
        <Select value={destinoFilter} onValueChange={setDestinoFilter}>
          <SelectTrigger className="h-9 text-xs w-[150px] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os destinos</SelectItem>
            {destinos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="h-9 px-2.5 text-xs shrink-0" onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Novo bloqueio</span>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-2">{filtered.length} de {blocks.length} bloqueio(s)</p>

      <div className="rounded-none border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">OD</th>
              <th className="px-3 py-2 font-semibold">Mês</th>
              <th className="px-3 py-2 font-semibold">Ida</th>
              <th className="px-3 py-2 font-semibold">Volta</th>
              <th className="px-3 py-2 font-semibold">Voo ida</th>
              <th className="px-3 py-2 font-semibold">Horário ida</th>
              <th className="px-3 py-2 font-semibold">Voo volta</th>
              <th className="px-3 py-2 font-semibold">Horário volta</th>
              <th className="px-3 py-2 font-semibold text-center">Assentos</th>
              <th className="px-3 py-2 font-semibold">Prazo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(b => {
              const status = prazoStatus(b.prazo)
              const soldOut = b.assentos_disponiveis === 0
              return (
                <tr key={b.id} className={cn('hover:bg-muted/30 transition-colors', soldOut && 'opacity-60')}>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{b.origem}{b.destino}</td>
                  <td className="px-3 py-2 capitalize whitespace-nowrap">{monthLabel(b.data_ida)}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtDate(b.data_ida)}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtDate(b.data_volta)}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{b.voo_ida || '—'}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{b.horario_ida || '—'}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{b.voo_volta || '—'}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{b.horario_volta || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSeatDelta(b, -1)}
                        disabled={b.assentos_disponiveis === 0}
                        className="w-5 h-5 grid place-items-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-30"
                        aria-label="Diminuir assentos"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className={cn(
                        'min-w-[2.5rem] text-center font-semibold tabular-nums',
                        soldOut ? 'text-destructive' : b.assentos_disponiveis <= 3 ? 'text-amber-600' : 'text-success',
                      )}>
                        {b.assentos_disponiveis}{b.assentos_total ? `/${b.assentos_total}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSeatDelta(b, 1)}
                        className="w-5 h-5 grid place-items-center rounded border text-muted-foreground hover:bg-muted"
                        aria-label="Aumentar assentos"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="tabular-nums">{fmtDate(b.prazo)}</span>
                    {status === 'vencido' && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">Vencido</Badge>}
                    {status === 'proximo' && <Badge variant="warning" className="ml-1.5 text-[10px] px-1.5 py-0">Próximo</Badge>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditing(b)} aria-label="Editar" title="Editar bloqueio">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(b.id)} aria-label="Excluir" title="Excluir bloqueio">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <BlockDialog orgSlug={orgSlug} editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh() }} />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bloqueio</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

function BlockDialog({
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
