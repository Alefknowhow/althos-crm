'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/ui/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import DocumentExtractDialog from '@/components/features/ai/DocumentExtractDialog'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { cn, formatCurrency } from '@/lib/utils'
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import {
  createBudgetDocument, updateBudgetDocument, deleteBudgetDocument, getBudgetDocumentSourceUrl,
  type BudgetDocumentRow,
} from '@/actions/budget-documents'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import { toast } from 'sonner'
import {
  FileStack, Plus, Trash2, ArrowLeft, Search, Save, Sparkles, ExternalLink, Printer,
} from 'lucide-react'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', sent: 'Enviado' }
const STATUS_VARIANT: Record<string, 'warning' | 'success'> = { draft: 'warning', sent: 'success' }

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

type Member = { user_id: string; name: string; email: string }

export default function BudgetDocumentsView({
  orgSlug, documents, members = [],
}: {
  orgSlug: string
  documents: BudgetDocumentRow[]
  members?: Member[]
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [extractOpen, setExtractOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [seller, setSeller] = useState<string>('all')
  const [dateBucket, setDateBucket] = useState<DateBucket>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter(d => {
      if (seller !== 'all' && d.created_by !== seller) return false
      if (!matchesDateBucket(d.created_at, dateBucket)) return false
      if (q && ![d.client_name, d.destination, d.hotel_name].filter(Boolean).join(' ').toLowerCase().includes(q)) return false
      return true
    })
  }, [documents, query, seller, dateBucket])

  const selected = documents.find(d => d.id === selectedId) ?? null

  async function handleExtracted(data: ExtractedTravelDocument, file: File) {
    setCreating(true)
    const fields = {
      client_name: data.cliente,
      destination: data.destino,
      hotel_name: data.hotel,
      start_date: data.data_ida,
      end_date: data.data_volta,
      total_cents: data.valor_total_cents || 0,
      operadora: data.operadora,
      observacoes: data.observacoes,
      extracted_data: data,
    }
    const fd = new FormData()
    fd.append('fields', JSON.stringify(fields))
    fd.append('file', file)
    const res = await createBudgetDocument(orgSlug, fd)
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Orçamento criado a partir do documento. Revise os dados.')
    setSelectedId(res.data.id)
    router.refresh()
  }

  async function handleSave(id: string, patch: Record<string, any>) {
    setSaving(true)
    const res = await updateBudgetDocument(orgSlug, id, patch)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Orçamento salvo')
    router.refresh()
  }

  async function handleDelete(id: string) {
    const res = await deleteBudgetDocument(orgSlug, id)
    if (res.ok) {
      toast.success('Orçamento excluído')
      if (selectedId === id) setSelectedId(null)
      router.refresh()
    } else toast.error(res.error)
  }

  if (documents.length === 0) {
    return (
      <>
        <div className="flex items-center justify-end mb-4">
          <Button onClick={() => setExtractOpen(true)} disabled={creating}>
            <Sparkles className="w-4 h-4 mr-1.5" /> Novo orçamento com IA
          </Button>
        </div>
        <EmptyState
          icon={FileStack}
          title="Nenhum orçamento IA ainda"
          description="Envie uma imagem ou PDF (print de reserva, orçamento de operadora, etc.) — a IA extrai os dados e monta um orçamento institucional com a marca da sua agência."
        />
        <DocumentExtractDialog
          orgSlug={orgSlug}
          open={extractOpen}
          onOpenChange={setExtractOpen}
          title="Novo orçamento com IA"
          description="Envie uma imagem ou PDF com os dados da viagem — a IA extrai o conteúdo e monta o orçamento institucional pra você revisar."
          onApply={handleExtracted}
        />
      </>
    )
  }

  return (
    <>
      {/* Filtros — tudo numa linha só, mesmo padrão da aba Cotações. */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por cliente, destino, hotel…" className="pl-8 h-9" />
        </div>

        {members.length > 0 && (
          <Select value={seller} onValueChange={setSeller}>
            <SelectTrigger className="h-9 text-xs w-[170px] shrink-0">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {members.map(m => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro de período: dropdown no mobile, pills no desktop. */}
        <ResponsiveSelect
          className="sm:hidden h-9 w-[110px] shrink-0 text-xs"
          aria-label="Filtrar por data"
          value={dateBucket}
          onValueChange={v => setDateBucket(v as DateBucket)}
          options={DATE_BUCKETS.map(b => ({ value: b.id, label: b.label }))}
        />
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {DATE_BUCKETS.map(b => (
            <button
              key={b.id}
              onClick={() => setDateBucket(b.id)}
              className={cn(
                'px-3 h-9 rounded-full border text-xs font-medium transition-colors',
                FOCUS_RING,
                dateBucket === b.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>

        <Button className="h-9 px-2.5 text-xs shrink-0" onClick={() => setExtractOpen(true)} disabled={creating}>
          <Sparkles className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Novo orçamento com IA</span>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-2">{filtered.length} de {documents.length} orçamento(s)</p>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100dvh-19rem)] min-h-[440px]">
        <div className={cn('rounded-none border bg-card overflow-y-auto divide-y', selected && 'hidden md:block')}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum orçamento encontrado.</div>
          ) : filtered.map(d => {
            const active = d.id === selectedId
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={cn('w-full text-left p-3 transition-colors', FOCUS_RING, active ? 'bg-primary/5' : 'hover:bg-muted/50')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm leading-tight truncate">{d.client_name || 'Sem cliente'}</span>
                  <Badge variant={STATUS_VARIANT[d.status]} className="shrink-0 text-[10px] px-1.5 py-0">{STATUS_LABELS[d.status]}</Badge>
                </div>
                {d.destination && <p className="text-xs text-muted-foreground truncate mt-1">{d.destination}</p>}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold tabular-nums">{formatCurrency(d.total_cents || 0)}</span>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(d.start_date)}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className={cn('rounded-none border bg-card overflow-y-auto', !selected && 'hidden md:flex')}>
          {selected
            ? <BudgetEditor
                key={selected.id}
                orgSlug={orgSlug}
                doc={selected}
                saving={saving}
                onBack={() => setSelectedId(null)}
                onDelete={() => setDeleteId(selected.id)}
                onSave={patch => handleSave(selected.id, patch)}
              />
            : (
              <div className="m-auto text-center text-sm text-muted-foreground p-8">
                <FileStack className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Selecione um orçamento para ver os detalhes.
              </div>
            )}
        </div>
      </div>

      <DocumentExtractDialog
        orgSlug={orgSlug}
        open={extractOpen}
        onOpenChange={setExtractOpen}
        title="Novo orçamento com IA"
        description="Envie uma imagem ou PDF com os dados da viagem — a IA extrai o conteúdo e monta o orçamento institucional pra você revisar."
        onApply={handleExtracted}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento</AlertDialogTitle>
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

function BudgetEditor({
  orgSlug, doc, saving, onSave, onBack, onDelete,
}: {
  orgSlug: string
  doc: BudgetDocumentRow
  saving: boolean
  onSave: (patch: Record<string, any>) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [d, setD] = useState<BudgetDocumentRow>(doc)
  const set = (k: keyof BudgetDocumentRow, v: any) => setD(prev => ({ ...prev, [k]: v }))
  const [includedText, setIncludedText] = useState((doc.included || []).join(', '))
  const [notIncludedText, setNotIncludedText] = useState((doc.not_included || []).join(', '))
  const [paymentText, setPaymentText] = useState((doc.payment_conditions || []).map(p => p.label).join('\n'))
  const [openingSource, setOpeningSource] = useState(false)

  const patch = () => ({
    contato_id: d.contato_id, client_name: d.client_name, destination: d.destination, hotel_name: d.hotel_name,
    start_date: d.start_date || null, end_date: d.end_date || null,
    pax_adults: d.pax_adults, pax_children: d.pax_children,
    included: includedText.split(',').map(s => s.trim()).filter(Boolean),
    not_included: notIncludedText.split(',').map(s => s.trim()).filter(Boolean),
    payment_conditions: paymentText.split('\n').map(s => s.trim()).filter(Boolean).map(label => ({ label, value: '' })),
    total_cents: d.total_cents, price_per_person_cents: d.price_per_person_cents,
    validity_days: d.validity_days, operadora: d.operadora, observacoes: d.observacoes, status: d.status,
  })

  async function handleOpenSource() {
    setOpeningSource(true)
    const res = await getBudgetDocumentSourceUrl(orgSlug, d.id)
    setOpeningSource(false)
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
            <FileStack className="w-4 h-4 text-primary shrink-0" /> {d.client_name || 'Orçamento'}
          </h2>
          <div className="mt-1.5"><Badge variant={STATUS_VARIANT[d.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[d.status]}</Badge></div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {d.origem_arquivo && (
            <Button variant="outline" size="sm" disabled={openingSource} onClick={handleOpenSource} title="Ver arquivo original">
              <ExternalLink className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Original</span>
            </Button>
          )}
          <a href={`/app/${orgSlug}/cotacoes/${d.id}/orcamento`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" title="Gerar orçamento em PDF">
              <Printer className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Gerar PDF</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave(patch())}>
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Cliente"><Input value={d.client_name || ''} onChange={e => set('client_name', e.target.value)} /></Field>
          <Field label="Destino"><Input value={d.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
          <Field label="Hotel"><Input value={d.hotel_name || ''} onChange={e => set('hotel_name', e.target.value)} /></Field>
          <Field label="Data de ida"><Input type="date" value={d.start_date || ''} onChange={e => set('start_date', e.target.value)} /></Field>
          <Field label="Data de volta"><Input type="date" value={d.end_date || ''} onChange={e => set('end_date', e.target.value)} /></Field>
          <Field label="Operadora"><Input value={d.operadora || ''} onChange={e => set('operadora', e.target.value)} /></Field>
          <Field label="Adultos"><Input type="number" min="0" value={d.pax_adults ?? ''} onChange={e => set('pax_adults', e.target.value ? parseInt(e.target.value) : null)} /></Field>
          <Field label="Crianças"><Input type="number" min="0" value={d.pax_children ?? ''} onChange={e => set('pax_children', e.target.value ? parseInt(e.target.value) : null)} /></Field>
          <Field label="Validade (dias)"><Input type="number" min="1" value={d.validity_days} onChange={e => set('validity_days', parseInt(e.target.value) || 1)} /></Field>
          <Field label="Valor total"><MoneyInput value={d.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
          <Field label="Valor por pessoa"><MoneyInput value={d.price_per_person_cents || 0} onChange={c => set('price_per_person_cents', c)} /></Field>
          <Field label="Status">
            <Select value={d.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Incluso (separado por vírgula)">
          <Input value={includedText} onChange={e => setIncludedText(e.target.value)} placeholder="Café da manhã, Traslado, Seguro viagem" />
        </Field>
        <Field label="Não incluso (separado por vírgula)">
          <Input value={notIncludedText} onChange={e => setNotIncludedText(e.target.value)} placeholder="Passeios opcionais, Taxas de embarque" />
        </Field>
        <Field label="Condições de pagamento (uma por linha)">
          <Textarea rows={3} value={paymentText} onChange={e => setPaymentText(e.target.value)} placeholder={'Pix à vista com 5% de desconto\nCartão em até 10x sem juros'} />
        </Field>
        <Field label="Observações"><Textarea rows={2} value={d.observacoes || ''} onChange={e => set('observacoes', e.target.value)} /></Field>
      </div>
    </div>
  )
}
