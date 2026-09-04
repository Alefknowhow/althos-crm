'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  createBudgetDocument, updateBudgetDocument, deleteBudgetDocument,
  type BudgetDocumentRow,
} from '@/actions/budget-documents'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import { toast } from 'sonner'
import { FileStack, Search, Sparkles } from 'lucide-react'
import { BudgetEditor, STATUS_LABELS, STATUS_VARIANT } from './BudgetDocumentsEditor'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

function fmtDate(d?: string | null) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—' }

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
      {/* Filtros — tudo numa linha só, mesmo padrão da aba Cotações. Some no
          mobile quando um orçamento está aberto. */}
      <div className={cn('flex items-center gap-1.5 mb-4 flex-wrap', selected && 'hidden md:flex')}>
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

      <p className={cn('text-sm text-muted-foreground mb-2', selected && 'hidden md:block')}>
        {filtered.length} de {documents.length} orçamento(s)
      </p>

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
