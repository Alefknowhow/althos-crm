'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { cn, formatCurrency } from '@/lib/utils'
import {
  createFinancialEntry, updateFinancialEntry, deleteFinancialEntry, suggestCategoryForEntry,
  uploadFinancialAttachment, deleteFinancialAttachment, getFinancialAttachmentUrl,
  type FinancialEntryRow,
} from '@/actions/financial'
import FinancialCsvImporter from './FinancialCsvImporter'
import { toast } from 'sonner'
import {
  Wallet, Plus, Trash2, ArrowLeft, Search, Save, Sparkles, Upload, Paperclip, FileIcon,
  ImageIcon, X, Loader2, TrendingUp, TrendingDown,
} from 'lucide-react'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado',
}
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'outline'> = {
  pendente: 'warning', pago: 'success', vencido: 'destructive', cancelado: 'outline',
}

function centsToReais(c?: number | null) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
function fmtDate(d?: string | null) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—' }

function MoneyInput({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input inputMode="decimal" placeholder="R$ 0,00" value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }} />
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

export default function FinancialEntriesView({
  orgSlug, entries, initialSelectedId,
}: {
  orgSlug: string
  entries: FinancialEntryRow[]
  initialSelectedId?: string | null
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(
    (initialSelectedId && entries.some(e => e.id === initialSelectedId) ? initialSelectedId : entries[0]?.id) ?? null,
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'all' | 'receita' | 'despesa'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(e => {
      if (tipoFilter !== 'all' && e.tipo !== tipoFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (q) {
        const hay = [e.categoria, e.subcategoria, e.observacoes, e.operadora].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [entries, query, tipoFilter, statusFilter])

  const selected = entries.find(e => e.id === selectedId) ?? null

  async function handleDelete(id: string) {
    const res = await deleteFinancialEntry(orgSlug, id)
    if (res.ok) {
      toast.success('Lançamento excluído')
      if (selectedId === id) setSelectedId(null)
      router.refresh()
    } else toast.error(res.error)
  }

  async function handleSave(id: string, patch: Record<string, any>) {
    setSaving(true)
    const res = await updateFinancialEntry(orgSlug, id, patch)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Lançamento salvo')
    router.refresh()
  }

  if (entries.length === 0) {
    return (
      <>
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Importar CSV
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo lançamento
          </Button>
        </div>
        <EmptyState
          icon={Wallet}
          title="Nenhum lançamento financeiro ainda"
          description="Registre manualmente com 'Novo lançamento' ou importe um extrato bancário em CSV."
        />
        <NewEntryDialog orgSlug={orgSlug} open={newOpen} onOpenChange={setNewOpen} creating={creating} setCreating={setCreating} onCreated={id => { setNewOpen(false); setSelectedId(id); router.refresh() }} />
        <FinancialCsvImporter orgSlug={orgSlug} open={csvOpen} onOpenChange={setCsvOpen} />
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 mb-4">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por categoria, operadora, observações…" className="pl-8 h-9" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as any)}>
            <SelectTrigger className="h-9 text-xs w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Receita e despesa</SelectItem>
              <SelectItem value="receita">Só receitas</SelectItem>
              <SelectItem value="despesa">Só despesas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-9" onClick={() => setCsvOpen(true)}>
            <Upload className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Importar CSV</span>
          </Button>
          <Button size="sm" className="h-9" onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Novo lançamento</span>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-2">{filtered.length} de {entries.length} lançamento(s)</p>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100dvh-19rem)] min-h-[440px]">
        <div className={cn('rounded-none border bg-card overflow-y-auto divide-y', selected && 'hidden md:block')}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado com esses filtros.</div>
          ) : filtered.map(e => {
            const active = e.id === selectedId
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={cn('w-full text-left p-3 transition-colors', FOCUS_RING, active ? 'bg-primary/5' : 'hover:bg-muted/50')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm leading-tight truncate flex items-center gap-1.5">
                    {e.tipo === 'receita'
                      ? <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
                      : <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />}
                    {e.categoria}
                  </span>
                  <Badge variant={STATUS_VARIANT[e.status]} className="shrink-0 text-[10px] px-1.5 py-0">{STATUS_LABELS[e.status]}</Badge>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className={cn('text-xs font-semibold tabular-nums', e.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                    {e.tipo === 'despesa' ? '- ' : ''}{formatCurrency(e.valor_cents)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(e.competencia)}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className={cn('rounded-none border bg-card overflow-y-auto', !selected && 'hidden md:flex')}>
          {selected
            ? <EntryEditor
                key={selected.id}
                orgSlug={orgSlug}
                entry={selected}
                saving={saving}
                onBack={() => setSelectedId(null)}
                onDelete={() => setDeleteId(selected.id)}
                onSave={patch => handleSave(selected.id, patch)}
              />
            : (
              <div className="m-auto text-center text-sm text-muted-foreground p-8">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Selecione um lançamento para ver os detalhes.
              </div>
            )}
        </div>
      </div>

      <NewEntryDialog orgSlug={orgSlug} open={newOpen} onOpenChange={setNewOpen} creating={creating} setCreating={setCreating} onCreated={id => { setNewOpen(false); setSelectedId(id); router.refresh() }} />
      <FinancialCsvImporter orgSlug={orgSlug} open={csvOpen} onOpenChange={setCsvOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. Anexos vinculados também serão removidos.</AlertDialogDescription>
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

function TipoToggle({ value, onChange }: { value: 'receita' | 'despesa'; onChange: (v: 'receita' | 'despesa') => void }) {
  return (
    <div className="flex gap-1.5">
      {(['receita', 'despesa'] as const).map(t => {
        const active = value === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              'flex-1 h-9 rounded-lg border text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5',
              FOCUS_RING,
              active
                ? t === 'receita' ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'
                : 'bg-background hover:bg-muted text-muted-foreground border-border',
            )}
          >
            {t === 'receita' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {t === 'receita' ? 'Receita' : 'Despesa'}
          </button>
        )
      })}
    </div>
  )
}

function NewEntryDialog({
  orgSlug, open, onOpenChange, creating, setCreating, onCreated,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  creating: boolean
  setCreating: (b: boolean) => void
  onCreated: (id: string) => void
}) {
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa')
  const [categoria, setCategoria] = useState('')
  const [valorCents, setValorCents] = useState(0)
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 10))
  const [vencimento, setVencimento] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [suggesting, setSuggesting] = useState(false)

  function reset() {
    setTipo('despesa'); setCategoria(''); setValorCents(0)
    setCompetencia(new Date().toISOString().slice(0, 10)); setVencimento(''); setObservacoes('')
  }

  async function handleSuggest() {
    if (!observacoes.trim()) { toast.error('Escreva uma observação/descrição para eu sugerir a categoria.'); return }
    setSuggesting(true)
    const res = await suggestCategoryForEntry(orgSlug, { descricao: observacoes, tipo })
    setSuggesting(false)
    if (res.ok) setCategoria(res.categoria)
    else toast.error(res.error)
  }

  async function handleCreate() {
    if (!categoria.trim()) { toast.error('Informe a categoria.'); return }
    if (!valorCents) { toast.error('Informe o valor.'); return }
    setCreating(true)
    const res = await createFinancialEntry(orgSlug, {
      tipo, categoria: categoria.trim(), valor_cents: valorCents, competencia,
      vencimento: vencimento || null, observacoes: observacoes.trim() || null,
    })
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Lançamento criado')
    reset()
    onCreated(res.data.id)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma receita ou despesa financeira.</DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <TipoToggle value={tipo} onChange={setTipo} />

          <div className="space-y-1">
            <Label className="text-xs">Observações / descrição</Label>
            <Textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: pagamento de comissão do consultor X" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs flex items-center justify-between">
                Categoria <span className="text-destructive">*</span>
                <button type="button" onClick={handleSuggest} disabled={suggesting} className="text-primary hover:underline inline-flex items-center gap-1 text-[11px] font-normal">
                  <Sparkles className="w-3 h-3" /> {suggesting ? 'Sugerindo…' : 'Sugerir com IA'}
                </button>
              </Label>
              <Input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: Comissão, Marketing, Passagens…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor <span className="text-destructive">*</span></Label>
              <MoneyInput value={valorCents} onChange={setValorCents} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Competência</Label>
              <Input type="date" value={competencia} onChange={e => setCompetencia(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={creating} onClick={handleCreate}>{creating ? 'Criando…' : 'Criar lançamento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EntryEditor({
  orgSlug, entry, saving, onSave, onBack, onDelete,
}: {
  orgSlug: string
  entry: FinancialEntryRow
  saving: boolean
  onSave: (patch: Record<string, any>) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [e, setE] = useState<FinancialEntryRow>(entry)
  const set = (k: keyof FinancialEntryRow, v: any) => setE(prev => ({ ...prev, [k]: v }))
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  const patch = () => ({
    tipo: e.tipo, categoria: e.categoria, subcategoria: e.subcategoria, centro_custo: e.centro_custo,
    conta_bancaria: e.conta_bancaria, forma_pagamento: e.forma_pagamento, valor_cents: e.valor_cents,
    competencia: e.competencia, vencimento: e.vencimento, data_pagamento: e.data_pagamento,
    status: e.status, operadora: e.operadora, observacoes: e.observacoes,
  })

  async function handleSuggest() {
    if (!e.observacoes?.trim()) { toast.error('Escreva uma observação para eu sugerir a categoria.'); return }
    setSuggesting(true)
    const res = await suggestCategoryForEntry(orgSlug, { descricao: e.observacoes, tipo: e.tipo })
    setSuggesting(false)
    if (res.ok) set('categoria', res.categoria)
    else toast.error(res.error)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadFinancialAttachment(orgSlug, e.id, fd)
      if (res.ok) set('anexos', res.anexos)
      else toast.error(`${file.name}: ${res.error}`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleRemoveAttachment(path: string) {
    const res = await deleteFinancialAttachment(orgSlug, e.id, path)
    if (res.ok) set('anexos', res.anexos)
    else toast.error(res.error)
  }

  async function handleOpenAttachment(path: string) {
    const res = await getFinancialAttachmentUrl(orgSlug, e.id, path)
    if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer')
    else toast.error(res.error)
  }

  return (
    <div className="flex flex-col w-full">
      <div className="sticky top-0 bg-card/90 border-b p-4 flex items-start gap-3 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate flex items-center gap-2">
            {e.tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success shrink-0" /> : <TrendingDown className="w-4 h-4 text-destructive shrink-0" />}
            {e.categoria || 'Lançamento'}
          </h2>
          <div className="mt-1.5">
            <Badge variant={STATUS_VARIANT[e.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[e.status]}</Badge>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave(patch())}>
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir" title="Excluir lançamento">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <TipoToggle value={e.tipo} onChange={v => set('tipo', v)} />

        <Field label="Observações / descrição"><Textarea rows={2} value={e.observacoes || ''} onChange={ev => set('observacoes', ev.target.value)} /></Field>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={<span className="flex items-center justify-between w-full">Categoria
            <button type="button" onClick={handleSuggest} disabled={suggesting} className="text-primary hover:underline inline-flex items-center gap-1 text-[11px] font-normal">
              <Sparkles className="w-3 h-3" /> {suggesting ? 'Sugerindo…' : 'Sugerir com IA'}
            </button></span>}>
            <Input value={e.categoria || ''} onChange={ev => set('categoria', ev.target.value)} />
          </Field>
          <Field label="Subcategoria"><Input value={e.subcategoria || ''} onChange={ev => set('subcategoria', ev.target.value)} /></Field>
          <Field label="Centro de custo"><Input value={e.centro_custo || ''} onChange={ev => set('centro_custo', ev.target.value)} /></Field>
          <Field label="Valor"><MoneyInput value={e.valor_cents} onChange={c => set('valor_cents', c)} /></Field>
          <Field label="Competência"><Input type="date" value={e.competencia || ''} onChange={ev => set('competencia', ev.target.value)} /></Field>
          <Field label="Vencimento"><Input type="date" value={e.vencimento || ''} onChange={ev => set('vencimento', ev.target.value)} /></Field>
          <Field label="Data de pagamento"><Input type="date" value={e.data_pagamento || ''} onChange={ev => set('data_pagamento', ev.target.value)} /></Field>
          <Field label="Conta bancária"><Input value={e.conta_bancaria || ''} onChange={ev => set('conta_bancaria', ev.target.value)} /></Field>
          <Field label="Forma de pagamento"><Input value={e.forma_pagamento || ''} onChange={ev => set('forma_pagamento', ev.target.value)} placeholder="Pix, Cartão, Boleto…" /></Field>
          <Field label="Operadora"><Input value={e.operadora || ''} onChange={ev => set('operadora', ev.target.value)} /></Field>
          <Field label="Status">
            <Select value={e.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Anexos">
          <div className="space-y-2">
            {e.anexos?.length > 0 && (
              <ul className="space-y-1.5">
                {e.anexos.map((a, i) => {
                  const isPdf = a.mime_type === 'application/pdf'
                  return (
                    <li key={`${a.path}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                      {isPdf ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                      <button type="button" onClick={() => handleOpenAttachment(a.path)} className="flex-1 min-w-0 truncate text-left text-xs text-foreground hover:underline">
                        {a.name}
                      </button>
                      <button type="button" onClick={() => handleRemoveAttachment(a.path)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover anexo">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={ev => handleFiles(ev.target.files)} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Adicionar anexo</>}
            </Button>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Paperclip className="w-3 h-3" /> PDF ou imagem, até 15 MB cada.</p>
          </div>
        </Field>
      </div>
    </div>
  )
}
