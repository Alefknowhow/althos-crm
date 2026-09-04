'use client'

/**
 * Split across five files (this one has the list + toolbar component):
 *   - FinancialEntriesShared.tsx: formatters, small UI primitives,
 *     status/period constants
 *   - FinancialEntriesTableWidgets.tsx: SortableHead, IconAction,
 *     EntryDetailsModal
 *   - FinancialEntriesNewDialog.tsx: RecurrenceFields + NewEntryDialog
 *   - FinancialEntriesEditDialog.tsx: EditEntryDialog
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn, formatCurrency } from '@/lib/utils'
import {
  deleteFinancialEntry, updateFinancialEntry, getFinancialAttachmentUrl, type FinancialEntryRow,
} from '@/actions/financial'
import { type FinancialSettingType, type FinancialSettingRow } from '@/actions/financial-settings'
import FinancialCsvImporter from './FinancialCsvImporter'
import { toast } from 'sonner'
import {
  Wallet, Plus, Upload, Trash2, Search, Repeat, CreditCard,
  Eye, Pencil, CheckCircle2, Circle, TrendingUp, TrendingDown,
} from 'lucide-react'
import {
  STATUS_LABELS, STATUS_VARIANT, PAGE_SIZE, type PeriodId, type SortKey,
  fmtDate, periodRange, PeriodFilterDropdown, SummaryCard,
} from './FinancialEntriesShared'
import { SortableHead, IconAction, EntryDetailsModal } from './FinancialEntriesTableWidgets'
import { NewEntryDialog } from './FinancialEntriesNewDialog'
import { EditEntryDialog } from './FinancialEntriesEditDialog'

export default function FinancialEntriesView({
  orgSlug, entries, settings, initialSelectedId,
}: {
  orgSlug: string
  entries: FinancialEntryRow[]
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
  initialSelectedId?: string | null
}) {
  const router = useRouter()
  const [detailsId, setDetailsId] = useState<string | null>(initialSelectedId ?? null)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'all' | 'receita' | 'despesa'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [period, setPeriod] = useState<PeriodId>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'competencia', dir: 'desc' })
  const [page, setPage] = useState(1)

  const hasActiveFilters = query.trim() !== '' || tipoFilter !== 'all' || statusFilter !== 'all' || period !== 'all'

  function clearFilters() {
    setQuery(''); setTipoFilter('all'); setStatusFilter('all'); setPeriod('all'); setCustomFrom(''); setCustomTo(''); setPage(1)
  }

  const { from, to } = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(e => {
      if (tipoFilter !== 'all' && e.tipo !== tipoFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (from && e.competencia < from) return false
      if (to && e.competencia > to) return false
      if (q) {
        const hay = [
          e.categoria, e.subcategoria, e.observacoes, e.operadora, e.contato_nome,
          e.numero_documento, e.nota_fiscal, formatCurrency(e.valor_cents),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [entries, query, tipoFilter, statusFilter, from, to])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sort.key === 'valor_cents') { av = a.valor_cents; bv = b.valor_cents }
      else if (sort.key === 'status') { av = a.status; bv = b.status }
      else { av = a[sort.key] || ''; bv = b[sort.key] || '' }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const pageRows = sorted.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)

  const summary = useMemo(() => {
    let totalReceitas = 0, totalDespesas = 0, aReceber = 0, aPagar = 0
    for (const e of filtered) {
      if (e.status === 'cancelado') continue
      if (e.tipo === 'receita') {
        totalReceitas += e.valor_cents
        if (e.status === 'pendente' || e.status === 'vencido') aReceber += e.valor_cents
      } else {
        totalDespesas += e.valor_cents
        if (e.status === 'pendente' || e.status === 'vencido') aPagar += e.valor_cents
      }
    }
    return { totalReceitas, totalDespesas, aReceber, aPagar }
  }, [filtered])

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const detailsEntry = entries.find(e => e.id === detailsId) ?? null
  const editEntry = entries.find(e => e.id === editId) ?? null

  async function handleDelete(id: string) {
    const res = await deleteFinancialEntry(orgSlug, id)
    if (res.ok) {
      toast.success('Lançamento excluído')
      if (detailsId === id) setDetailsId(null)
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

  async function handleToggleStatus(e: FinancialEntryRow) {
    const nextStatus = e.status === 'pago' ? 'pendente' : 'pago'
    const res = await updateFinancialEntry(orgSlug, e.id, { status: nextStatus })
    if (res.ok) { toast.success(nextStatus === 'pago' ? 'Marcado como pago' : 'Marcado como pendente'); router.refresh() }
    else toast.error(res.error)
  }

  if (entries.length === 0) {
    return (
      <>
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Lançamento
          </Button>
          <Button variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Importar CSV
          </Button>
        </div>
        <EmptyState
          icon={Wallet}
          title="Nenhum lançamento financeiro ainda"
          description="Registre manualmente com 'Lançamento' ou importe um extrato bancário em CSV."
        />
        <NewEntryDialog orgSlug={orgSlug} settings={settings} open={newOpen} onOpenChange={setNewOpen} creating={creating} setCreating={setCreating} onCreated={id => { setNewOpen(false); setDetailsId(id); router.refresh() }} />
        <FinancialCsvImporter orgSlug={orgSlug} open={csvOpen} onOpenChange={setCsvOpen} />
      </>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Pesquisar lançamentos…" className="pl-8 h-9" />
        </div>

        <PeriodFilterDropdown value={period} customFrom={customFrom} customTo={customTo} onChange={(v, f, t) => { setPeriod(v); setCustomFrom(f); setCustomTo(t); setPage(1) }} />

        <Select value={tipoFilter} onValueChange={v => { setTipoFilter(v as any); setPage(1) }}>
          <SelectTrigger className="h-9 text-xs w-[110px] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="h-9 text-xs w-[120px] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button size="sm" className="h-9 px-3 shrink-0" onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Lançamento
        </Button>

        <Button variant="outline" size="sm" className="h-9 px-2.5 text-xs shrink-0" onClick={() => setCsvOpen(true)}>
          <Upload className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Importar CSV</span>
        </Button>

        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline shrink-0">
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Cards de resumo ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <SummaryCard label="Total de receitas" value={formatCurrency(summary.totalReceitas)} icon={TrendingUp} tone="success" />
        <SummaryCard label="Total de despesas" value={formatCurrency(summary.totalDespesas)} icon={TrendingDown} tone="destructive" />
        <SummaryCard label="A receber" value={formatCurrency(summary.aReceber)} icon={Circle} tone="warning" />
        <SummaryCard label="A pagar" value={formatCurrency(summary.aPagar)} icon={Circle} tone="warning" />
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Data" active={sort.key === 'competencia'} dir={sort.dir} onClick={() => toggleSort('competencia')} />
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente/Fornecedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tipo</TableHead>
              <SortableHead label="Vencimento" active={sort.key === 'vencimento'} dir={sort.dir} onClick={() => toggleSort('vencimento')} />
              <SortableHead label="Valor" active={sort.key === 'valor_cents'} dir={sort.dir} onClick={() => toggleSort('valor_cents')} className="text-right" />
              <SortableHead label="Status" active={sort.key === 'status'} dir={sort.dir} onClick={() => toggleSort('status')} />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground py-6">
                    <Wallet className="w-6 h-6 opacity-40 mb-1" />
                    <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
                    <p className="text-xs">Tente alterar os filtros ou realizar uma nova pesquisa.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : pageRows.map(e => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => setDetailsId(e.id)}>
                <TableCell className="whitespace-nowrap text-xs">{fmtDate(e.competencia)}</TableCell>
                <TableCell className="max-w-[220px]">
                  <span className="truncate block text-sm">
                    {e.observacoes || e.categoria}
                    {e.is_recurring && <Repeat className="inline w-3 h-3 ml-1 text-muted-foreground align-[-1px]" aria-label="Recorrente" />}
                    {e.installment_group_id && <CreditCard className="inline w-3 h-3 ml-1 text-muted-foreground align-[-1px]" aria-label={`Parcela ${e.parcela_numero}/${e.parcela_total}`} />}
                  </span>
                </TableCell>
                <TableCell className="max-w-[160px] text-xs text-muted-foreground truncate">{e.contato_nome || e.operadora || '—'}</TableCell>
                <TableCell className="text-xs">{e.categoria}</TableCell>
                <TableCell>
                  {e.tipo === 'receita'
                    ? <span className="inline-flex items-center gap-1 text-xs text-success"><TrendingUp className="w-3.5 h-3.5" /> Receita</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-destructive"><TrendingDown className="w-3.5 h-3.5" /> Despesa</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{fmtDate(e.vencimento)}</TableCell>
                <TableCell className={cn('text-right text-sm font-semibold tabular-nums whitespace-nowrap', e.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                  {e.tipo === 'despesa' ? '- ' : ''}{formatCurrency(e.valor_cents)}
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[e.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[e.status]}</Badge></TableCell>
                <TableCell onClick={ev => ev.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <IconAction icon={Eye} label="Ver detalhes" onClick={() => setDetailsId(e.id)} />
                    <IconAction icon={e.status === 'pago' ? Circle : CheckCircle2} label={e.status === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'} onClick={() => handleToggleStatus(e)} />
                    <IconAction icon={Pencil} label="Editar" onClick={() => setEditId(e.id)} />
                    <IconAction icon={Trash2} label="Excluir" tone="destructive" onClick={() => setDeleteId(e.id)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sorted.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, sorted.length)} de {sorted.length} lançamento{sorted.length === 1 ? '' : 's'}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pageClamped <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
              <span className="px-1">{pageClamped} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pageClamped >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próxima</Button>
            </div>
          )}
        </div>
      )}

      <NewEntryDialog orgSlug={orgSlug} settings={settings} open={newOpen} onOpenChange={setNewOpen} creating={creating} setCreating={setCreating} onCreated={id => { setNewOpen(false); setDetailsId(id); router.refresh() }} />
      <FinancialCsvImporter orgSlug={orgSlug} open={csvOpen} onOpenChange={setCsvOpen} />

      {detailsEntry && (
        <EntryDetailsModal
          entry={detailsEntry}
          open={!!detailsId}
          onOpenChange={o => !o && setDetailsId(null)}
          onEdit={() => { setEditId(detailsEntry.id); setDetailsId(null) }}
          onOpenAttachment={async (path, isImage, name) => {
            const res = await getFinancialAttachmentUrl(orgSlug, detailsEntry.id, path)
            if (!res.ok) { toast.error(res.error); return }
            // Imagem abre num pop-up dentro do próprio app; PDF continua em
            // nova aba (o navegador já renderiza PDF bem, sem precisar de
            // visualizador próprio aqui).
            if (isImage) setPreviewAttachment({ url: res.url, name })
            else window.open(res.url, '_blank', 'noopener,noreferrer')
          }}
        />
      )}

      {previewAttachment && (
        <Dialog open onOpenChange={o => !o && setPreviewAttachment(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate">{previewAttachment.name}</DialogTitle>
            </DialogHeader>
            <img src={previewAttachment.url} alt={previewAttachment.name} className="w-full max-h-[75vh] object-contain rounded-md" />
          </DialogContent>
        </Dialog>
      )}

      {editEntry && (
        <EditEntryDialog
          orgSlug={orgSlug}
          entry={editEntry}
          settings={settings}
          saving={saving}
          open={!!editId}
          onOpenChange={o => !o && setEditId(null)}
          onSave={patch => { handleSave(editEntry.id, patch); setEditId(null) }}
          onDelete={() => { setDeleteId(editEntry.id); setEditId(null) }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não poderá ser desfeita. Anexos vinculados também serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

