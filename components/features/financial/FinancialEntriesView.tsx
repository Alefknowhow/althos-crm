'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import EmptyState from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn, formatCurrency } from '@/lib/utils'
import {
  createFinancialEntry, updateFinancialEntry, deleteFinancialEntry,
  uploadFinancialAttachment, deleteFinancialAttachment, getFinancialAttachmentUrl,
  type FinancialEntryRow,
} from '@/actions/financial'
import { type FinancialSettingType, type FinancialSettingRow } from '@/actions/financial-settings'
import FinancialCsvImporter from './FinancialCsvImporter'
import FinancialDocumentPanel from './FinancialDocumentPanel'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  FREQUENCY_LABELS, computeRecurrenceDates, computeInstallmentDates,
  type RecurrenceFrequency,
} from '@/lib/financial/recurrence'
import type { ExtractedFinancialDocument } from '@/lib/ai/financial-document-extract'
import { toast } from 'sonner'
import {
  Wallet, Plus, Trash2, Search, Save, Upload, Paperclip, FileIcon,
  ImageIcon, X, Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Repeat, CreditCard,
  AlertTriangle, Copy, Eye, Pencil, CheckCircle2, Circle, CalendarRange, ArrowUpDown, Sparkles,
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

/** Select alimentado pelas listas cadastradas em Configurações (sem digitação livre). */
function SettingSelect({
  value, onChange, options, placeholder = 'Selecione…', required,
}: {
  value: string | null | undefined
  onChange: (v: string | null) => void
  options: string[]
  placeholder?: string
  required?: boolean
}) {
  return (
    <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? null : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {!required && <SelectItem value="__none__">— Nenhuma —</SelectItem>}
        {options.length === 0 && <SelectItem value="__empty__" disabled>Nenhum item cadastrado</SelectItem>}
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

/** Junta as opções cadastradas com um valor avulso ainda não cadastrado (ex.: sugestão de IA), pra não sumir da tela até o próximo refresh. */
function withExtra(options: FinancialSettingRow[], extra?: string | null): string[] {
  const names = options.map(o => o.name)
  if (extra && !names.some(n => n.toLowerCase() === extra.toLowerCase())) names.unshift(extra)
  return names
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

/* ────────────────────────────────────────────────────────────────────────
 * Período — filtro compacto da toolbar. Local a este módulo (não usa
 * lib/utils/period-range.ts porque o Financeiro precisa de "Hoje" e "Todos
 * os períodos", que o seletor dos dashboards não tem, e filtra por
 * competência, não por um range genérico de comparação).
 * ──────────────────────────────────────────────────────────────────────── */

type PeriodId = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'

const PERIOD_LABELS: Record<PeriodId, string> = {
  all: 'Todos os períodos', today: 'Hoje', week: 'Esta semana', month: 'Este mês',
  last_month: 'Mês anterior', quarter: 'Este trimestre', year: 'Este ano', custom: 'Personalizado',
}

function toISO(d: Date): string { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10) }

function periodRange(id: PeriodId, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const now = new Date()
  switch (id) {
    case 'today': return { from: toISO(now), to: toISO(now) }
    case 'week': { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: toISO(s), to: toISO(e) } }
    case 'month': return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    case 'last_month': return { from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)) }
    case 'quarter': { const q = Math.floor(now.getMonth() / 3); return { from: toISO(new Date(now.getFullYear(), q * 3, 1)), to: toISO(new Date(now.getFullYear(), q * 3 + 3, 0)) } }
    case 'year': return { from: toISO(new Date(now.getFullYear(), 0, 1)), to: toISO(new Date(now.getFullYear(), 11, 31)) }
    case 'custom': return { from: customFrom || null, to: customTo || null }
    case 'all':
    default: return { from: null, to: null }
  }
}

function PeriodFilterDropdown({
  value, customFrom, customTo, onChange,
}: {
  value: PeriodId
  customFrom: string
  customTo: string
  onChange: (v: PeriodId, from: string, to: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Select value={value} onValueChange={v => onChange(v as PeriodId, customFrom, customTo)}>
        <SelectTrigger className="h-9 text-xs w-[150px]">
          <span className="flex items-center gap-1.5 truncate"><CalendarRange className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /><SelectValue /></span>
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(PERIOD_LABELS) as [PeriodId, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      {value === 'custom' && (
        <>
          <Input type="date" className="h-9 w-[135px] text-xs" value={customFrom} onChange={e => onChange('custom', e.target.value, customTo)} />
          <Input type="date" className="h-9 w-[135px] text-xs" value={customTo} onChange={e => onChange('custom', customFrom, e.target.value)} />
        </>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Cards de resumo — 4 cards compactos, horizontais, sem gráfico.
 * ──────────────────────────────────────────────────────────────────────── */

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: 'success' | 'destructive' | 'warning' | 'muted' }) {
  const toneClass = {
    success: 'text-success', destructive: 'text-destructive', warning: 'text-warning', muted: 'text-muted-foreground',
  }[tone]
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 flex items-center justify-between gap-2 min-w-0">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className={cn('text-base font-bold tabular-nums truncate', toneClass)}>{value}</p>
      </div>
      <Icon className={cn('w-4 h-4 shrink-0 opacity-70', toneClass)} />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Componente principal
 * ──────────────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 50

type SortKey = 'competencia' | 'vencimento' | 'valor_cents' | 'status'

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
          <Button variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Importar CSV
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Lançamento
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
        <Button size="sm" className="h-9 px-3 shrink-0" onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Lançamento
        </Button>

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
          onOpenAttachment={async path => {
            const res = await getFinancialAttachmentUrl(orgSlug, detailsEntry.id, path)
            if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer')
            else toast.error(res.error)
          }}
        />
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

function SortableHead({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; className?: string }) {
  return (
    <TableHead className={className}>
      <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground font-medium')}>
        {label}
        {active ? (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </TableHead>
  )
}

function IconAction({ icon: Icon, label, onClick, tone }: { icon: React.ElementType; label: string; onClick: () => void; tone?: 'destructive' }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              'w-7 h-7 inline-flex items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
              FOCUS_RING,
              tone === 'destructive' && 'hover:bg-destructive/10 hover:text-destructive',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Skeleton de carregamento — compacto, usado pelo Suspense fallback da
 * página (ver app/app/[orgSlug]/financeiro/page.tsx).
 * ──────────────────────────────────────────────────────────────────────── */

export function FinancialEntriesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-[150px]" />
        <Skeleton className="h-9 w-[110px]" />
        <Skeleton className="h-9 w-[120px]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Modal de detalhes — somente leitura + anexos, com atalho pra editar.
 * ──────────────────────────────────────────────────────────────────────── */

function EntryDetailsModal({
  entry, open, onOpenChange, onEdit, onOpenAttachment,
}: {
  entry: FinancialEntryRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onEdit: () => void
  onOpenAttachment: (path: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry.tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
            {entry.categoria}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground">Valor</p>
              <p className={cn('text-xl font-bold tabular-nums', entry.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                {entry.tipo === 'despesa' ? '- ' : ''}{formatCurrency(entry.valor_cents)}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-[11px] text-muted-foreground">Data</dt><dd>{fmtDate(entry.competencia)}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Vencimento</dt><dd>{fmtDate(entry.vencimento)}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Data de pagamento</dt><dd>{fmtDate(entry.data_pagamento)}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Cliente/Fornecedor</dt><dd className="truncate">{entry.contato_nome || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Categoria</dt><dd className="truncate">{entry.categoria}{entry.subcategoria ? ` / ${entry.subcategoria}` : ''}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Centro de custo</dt><dd className="truncate">{entry.centro_custo || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Conta bancária</dt><dd className="truncate">{entry.conta_bancaria || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Forma de pagamento</dt><dd className="truncate">{entry.forma_pagamento || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Documento</dt><dd className="truncate">{entry.numero_documento || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Nota fiscal</dt><dd className="truncate">{entry.nota_fiscal || '—'}</dd></div>
          </dl>

          {entry.observacoes && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Observações</p>
              <p className="text-sm whitespace-pre-wrap">{entry.observacoes}</p>
            </div>
          )}

          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5">Anexos</p>
            {entry.anexos?.length > 0 ? (
              <ul className="space-y-1.5">
                {entry.anexos.map((a, i) => {
                  const isPdf = a.mime_type === 'application/pdf'
                  const key = a.storage_object_id ?? a.path
                  return (
                    <li key={`${key}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                      {isPdf ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                      <button type="button" onClick={() => onOpenAttachment(key!)} className="flex-1 min-w-0 truncate text-left text-xs text-foreground hover:underline">
                        {a.name}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS) as [RecurrenceFrequency, string][]

function RecurrenceFields({
  frequency, setFrequency, count, setCount, until, setUntil, infinite, setInfinite,
}: {
  frequency: RecurrenceFrequency
  setFrequency: (f: RecurrenceFrequency) => void
  count: number
  setCount: (n: number) => void
  until: string
  setUntil: (v: string) => void
  infinite: boolean
  setInfinite: (b: boolean) => void
}) {
  return (
    <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Frequência">
          <Select value={frequency} onValueChange={v => setFrequency(v as RecurrenceFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={infinite ? 'Repetições (ignorado — infinita)' : 'Quantidade de repetições'}>
          <Input type="number" min={1} max={60} disabled={infinite} value={count} onChange={e => setCount(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Ou repetir até a data (opcional)">
          <Input type="date" value={until} onChange={e => setUntil(e.target.value)} disabled={infinite} />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
          <Checkbox checked={infinite} onCheckedChange={v => setInfinite(v === true)} />
          Recorrência infinita
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Gera até 60 ocorrências de uma vez (trava de segurança) — se marcar &quot;infinita&quot;, uma nova leva precisa ser gerada mais adiante.
      </p>
    </div>
  )
}

function NewEntryDialog({
  orgSlug, settings, open, onOpenChange, creating, setCreating, onCreated,
}: {
  orgSlug: string
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
  open: boolean
  onOpenChange: (o: boolean) => void
  creating: boolean
  setCreating: (b: boolean) => void
  onCreated: (id: string) => void
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [subcategoria, setSubcategoria] = useState<string | null>(null)
  const [centroCusto, setCentroCusto] = useState<string | null>(null)
  const [contaBancaria, setContaBancaria] = useState<string | null>(null)
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null)
  const [contatoId, setContatoId] = useState<string | null>(null)
  const [valorCents, setValorCents] = useState(0)
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 10))
  const [vencimento, setVencimento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('mensal')
  const [recCount, setRecCount] = useState(11)
  const [recUntil, setRecUntil] = useState('')
  const [recInfinite, setRecInfinite] = useState(false)

  const [isInstallment, setIsInstallment] = useState(false)
  const [installmentTotal, setInstallmentTotal] = useState(2)
  const [installmentInterval, setInstallmentInterval] = useState(30)

  const [showMore, setShowMore] = useState(false)
  const [notaFiscal, setNotaFiscal] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [projeto, setProjeto] = useState('')
  const [unidadeNegocio, setUnidadeNegocio] = useState('')

  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [step, setStep] = useState(0)

  function reset() {
    setTipo('despesa'); setCategoria(null); setSubcategoria(null); setCentroCusto(null)
    setContaBancaria(null); setFormaPagamento(null); setContatoId(null); setValorCents(0)
    setCompetencia(new Date().toISOString().slice(0, 10)); setVencimento(''); setObservacoes('')
    setIsRecurring(false); setFrequency('mensal'); setRecCount(11); setRecUntil(''); setRecInfinite(false)
    setIsInstallment(false); setInstallmentTotal(2); setInstallmentInterval(30)
    setShowMore(false); setNotaFiscal(''); setNumeroDocumento(''); setProjeto(''); setUnidadeNegocio('')
    setPendingFile(null)
    setStep(0)
  }

  function applyExtracted(data: ExtractedFinancialDocument) {
    if (data.tipo) setTipo(data.tipo)
    if (data.descricao) setObservacoes(data.descricao)
    if (data.categoria_sugerida) setCategoria(data.categoria_sugerida)
    if (data.valor_cents) setValorCents(data.valor_cents)
    if (data.data_emissao) setCompetencia(data.data_emissao)
    if (data.vencimento) setVencimento(data.vencimento)
    if (data.numero_documento) setNumeroDocumento(data.numero_documento)
    if (data.emissor && !observacoes) setObservacoes(prev => prev || `${data.descricao ? data.descricao + ' — ' : ''}${data.emissor}`)
  }

  const previewDates = useMemo(() => {
    const base = vencimento || competencia
    if (isInstallment && installmentTotal > 1) return computeInstallmentDates(base, installmentTotal, installmentInterval)
    if (isRecurring) return computeRecurrenceDates(base, { frequency, count: recCount, until: recUntil || null, infinite: recInfinite })
    return []
  }, [isRecurring, isInstallment, frequency, recCount, recUntil, recInfinite, installmentTotal, installmentInterval, vencimento, competencia])

  const WIZARD_STEPS = ['Anexo', 'Tipo', 'Informações básicas', 'Datas', 'Pagamento', 'Recorrência', 'Parcelamento', 'Resumo']

  function goNext() {
    if (step === 2 && (!categoria?.trim() || !valorCents)) {
      toast.error('Informe categoria e valor para continuar.')
      return
    }
    setStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }
  function goBack() {
    setStep(s => Math.max(s - 1, 0))
  }

  async function handleCreate(keepOpen = false) {
    if (!categoria?.trim()) { toast.error('Informe a categoria.'); return }
    if (!valorCents) { toast.error('Informe o valor.'); return }
    if (isRecurring && isInstallment) { toast.error('Escolha recorrência OU parcelamento, não os dois.'); return }
    if (previewDates.length > 20 && !confirm(`Isso vai gerar ${previewDates.length + 1} lançamentos. Confirmar?`)) return
    setCreating(true)
    const res = await createFinancialEntry(orgSlug, {
      tipo, categoria: categoria.trim(), subcategoria, centro_custo: centroCusto,
      conta_bancaria: contaBancaria, forma_pagamento: formaPagamento, contato_id: contatoId,
      valor_cents: valorCents, competencia, vencimento: vencimento || null,
      observacoes: observacoes.trim() || null,
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? frequency : null,
      recurrence_count: isRecurring && !recInfinite ? recCount : null,
      recurrence_until: isRecurring && recUntil ? recUntil : null,
      recurrence_infinite: isRecurring ? recInfinite : false,
      parcela_total: isInstallment ? installmentTotal : null,
      installment_interval_days: isInstallment ? installmentInterval : null,
      nota_fiscal: notaFiscal.trim() || null,
      numero_documento: numeroDocumento.trim() || null,
      projeto: projeto.trim() || null,
      unidade_negocio: unidadeNegocio.trim() || null,
    })
    if (!res.ok) { setCreating(false); toast.error(res.error); return }

    // Anexo escolhido antes de criar o lançamento (fluxo do "Ler com IA")
    // só sobe pro storage agora, que já existe um entryId pra vincular.
    if (pendingFile) {
      const fd = new FormData()
      fd.append('file', pendingFile)
      const upRes = await uploadFinancialAttachment(orgSlug, res.data.id, fd)
      if (!upRes.ok) toast.error(`Lançamento criado, mas o anexo falhou: ${upRes.error}`)
    }

    setCreating(false)
    toast.success('Lançamento criado')
    if (keepOpen) {
      const keepType = tipo
      reset()
      setTipo(keepType)
      router.refresh()
    } else {
      reset()
      onCreated(res.data.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma receita ou despesa financeira.</DialogDescription>
        </DialogHeader>

        {/* Mobile: 8-step wizard */}
        <div className="md:hidden -mx-6 px-6">
          <div className="flex items-center gap-1 mb-3">
            {WIZARD_STEPS.map((_, i) => (
              <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">Passo {step + 1} de {WIZARD_STEPS.length} — {WIZARD_STEPS[step]}</p>

          <div className="space-y-4 pb-24">
            {step === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Opcional: anexe uma nota fiscal, boleto ou recibo e use a IA pra preencher os campos automaticamente.</p>
                <FinancialDocumentPanel orgSlug={orgSlug} file={pendingFile} onFileSelected={setPendingFile} onExtracted={applyExtracted} />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <TipoToggle value={tipo} onChange={setTipo} />
                <div className="space-y-1.5">
                  <Label className="text-sm">Valor <span className="text-destructive">*</span></Label>
                  <MoneyInput value={valorCents} onChange={setValorCents} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Categoria <span className="text-destructive">*</span></Label>
                  <SettingSelect value={categoria} onChange={setCategoria} options={withExtra(settings.categoria, categoria)} required placeholder="Selecione a categoria" />
                </div>
                <Field label="Subcategoria">
                  <SettingSelect value={subcategoria} onChange={setSubcategoria} options={withExtra(settings.subcategoria, null)} />
                </Field>
                <Field label="Centro de custo">
                  <SettingSelect value={centroCusto} onChange={setCentroCusto} options={withExtra(settings.centro_custo, null)} />
                </Field>
                <div className="space-y-1.5">
                  <Label className="text-sm">Observações / descrição</Label>
                  <Textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: pagamento de comissão do consultor X" />
                </div>
                <Field label="Cliente ou fornecedor">
                  <LeadCombobox orgSlug={orgSlug} name="contato_id" placeholder="Buscar contato…" onChange={lead => setContatoId(lead?.id ?? null)} />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Competência</Label>
                  <Input type="date" inputMode="none" className="h-12 text-base" value={competencia} onChange={e => setCompetencia(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Vencimento</Label>
                  <Input type="date" inputMode="none" className="h-12 text-base" value={vencimento} onChange={e => setVencimento(e.target.value)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <Field label="Conta bancária">
                  <SettingSelect value={contaBancaria} onChange={setContaBancaria} options={withExtra(settings.conta_bancaria, null)} />
                </Field>
                <Field label="Forma de pagamento">
                  <SettingSelect value={formaPagamento} onChange={setFormaPagamento} options={withExtra(settings.forma_pagamento, null)} />
                </Field>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-base py-2 cursor-pointer">
                  <Checkbox className="h-5 w-5" checked={isRecurring} onCheckedChange={v => { setIsRecurring(v === true); if (v) setIsInstallment(false) }} />
                  <span className="flex items-center gap-1.5"><Repeat className="w-4 h-4 text-muted-foreground" /> Possui recorrência?</span>
                </label>
                {isRecurring && (
                  <RecurrenceFields
                    frequency={frequency} setFrequency={setFrequency}
                    count={recCount} setCount={setRecCount}
                    until={recUntil} setUntil={setRecUntil}
                    infinite={recInfinite} setInfinite={setRecInfinite}
                  />
                )}
                {!isRecurring && <p className="text-xs text-muted-foreground">Deixe desmarcado se for um lançamento único.</p>}
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-base py-2 cursor-pointer">
                  <Checkbox className="h-5 w-5" checked={isInstallment} onCheckedChange={v => { setIsInstallment(v === true); if (v) setIsRecurring(false) }} />
                  <span className="flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-muted-foreground" /> Compra parcelada?</span>
                </label>
                {isInstallment && (
                  <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                    <Field label="Quantidade de parcelas">
                      <Input type="number" inputMode="numeric" className="h-12 text-base" min={2} max={60} value={installmentTotal} onChange={e => setInstallmentTotal(Math.max(2, Number(e.target.value) || 2))} />
                    </Field>
                    <Field label="Intervalo entre parcelas (dias)">
                      <Input type="number" inputMode="numeric" className="h-12 text-base" min={1} value={installmentInterval} onChange={e => setInstallmentInterval(Math.max(1, Number(e.target.value) || 30))} />
                    </Field>
                    <p className="text-[11px] text-muted-foreground">
                      Valor por parcela: {formatCurrency(Math.round(valorCents / installmentTotal))} × {installmentTotal} (1ª parcela em {fmtDate(vencimento || competencia)}).
                    </p>
                  </div>
                )}
                {!isInstallment && <p className="text-xs text-muted-foreground">Deixe desmarcado se não for uma compra parcelada.</p>}
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 space-y-2.5 text-sm">
                  <div className="flex items-center gap-1.5">
                    {tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                    <span className={cn('font-semibold text-lg tabular-nums', tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                      {formatCurrency(valorCents)}
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Categoria</dt><dd className="text-right truncate">{categoria || '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Vencimento</dt><dd>{fmtDate(vencimento || competencia)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd>Pendente</dd></div>
                  </dl>
                  {previewDates.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">{isInstallment ? `${installmentTotal} parcelas` : 'Próximas ocorrências'}</p>
                      <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                        {previewDates.slice(0, 8).map(d => <li key={d}>{fmtDate(d)}</li>)}
                        {previewDates.length > 8 && <li>+ {previewDates.length - 8} mais…</li>}
                      </ul>
                    </div>
                  )}
                  {previewDates.length > 20 && (
                    <p className="text-[11px] text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Isso vai gerar {previewDates.length + 1} lançamentos.</p>
                  )}
                </div>

                <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setShowMore(v => !v)}>
                  {showMore ? 'Ocultar informações complementares' : 'Informações complementares (opcional)'}
                </button>
                {showMore && (
                  <div className="space-y-3">
                    <Field label="Número do documento"><Input value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} /></Field>
                    <Field label="Nota fiscal"><Input value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} /></Field>
                    <Field label="Projeto"><Input value={projeto} onChange={e => setProjeto(e.target.value)} /></Field>
                    <Field label="Unidade de negócio"><Input value={unidadeNegocio} onChange={e => setUnidadeNegocio(e.target.value)} /></Field>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 flex gap-2 z-50">
            {step > 0 && (
              <Button type="button" variant="outline" className="h-12" disabled={creating} onClick={goBack}>Voltar</Button>
            )}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="button" className="flex-1 h-12 text-base" onClick={goNext}>Avançar</Button>
            ) : (
              <Button type="button" className="flex-1 h-12 text-base" disabled={creating} onClick={() => handleCreate(false)}>
                {creating ? 'Criando…' : 'Confirmar lançamento'}
              </Button>
            )}
          </div>
        </div>

        {/* Desktop: single-page two-column form */}
        <div className="hidden md:grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> Anexo (opcional)</Label>
              <FinancialDocumentPanel orgSlug={orgSlug} file={pendingFile} onFileSelected={setPendingFile} onExtracted={applyExtracted} />
            </div>

            <TipoToggle value={tipo} onChange={setTipo} />

            <div className="space-y-1">
              <Label className="text-xs">Observações / descrição</Label>
              <Textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: pagamento de comissão do consultor X" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Categoria <span className="text-destructive">*</span></Label>
                <SettingSelect value={categoria} onChange={setCategoria} options={withExtra(settings.categoria, categoria)} required placeholder="Selecione a categoria" />
              </div>
              <Field label="Subcategoria">
                <SettingSelect value={subcategoria} onChange={setSubcategoria} options={withExtra(settings.subcategoria, null)} />
              </Field>
              <Field label="Centro de custo">
                <SettingSelect value={centroCusto} onChange={setCentroCusto} options={withExtra(settings.centro_custo, null)} />
              </Field>
              <div className="space-y-1">
                <Label className="text-xs">Valor <span className="text-destructive">*</span></Label>
                <MoneyInput value={valorCents} onChange={setValorCents} />
              </div>
              <Field label="Conta bancária">
                <SettingSelect value={contaBancaria} onChange={setContaBancaria} options={withExtra(settings.conta_bancaria, null)} />
              </Field>
              <Field label="Forma de pagamento">
                <SettingSelect value={formaPagamento} onChange={setFormaPagamento} options={withExtra(settings.forma_pagamento, null)} />
              </Field>
              <div className="space-y-1">
                <Label className="text-xs">Competência</Label>
                <Input type="date" value={competencia} onChange={e => setCompetencia(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
              </div>
            </div>

            <Field label="Cliente ou fornecedor">
              <LeadCombobox orgSlug={orgSlug} name="contato_id" placeholder="Buscar contato…" onChange={lead => setContatoId(lead?.id ?? null)} />
            </Field>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={isRecurring} onCheckedChange={v => { setIsRecurring(v === true); if (v) setIsInstallment(false) }} />
              <span className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5 text-muted-foreground" /> Possui recorrência?</span>
            </label>
            {isRecurring && (
              <RecurrenceFields
                frequency={frequency} setFrequency={setFrequency}
                count={recCount} setCount={setRecCount}
                until={recUntil} setUntil={setRecUntil}
                infinite={recInfinite} setInfinite={setRecInfinite}
              />
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={isInstallment} onCheckedChange={v => { setIsInstallment(v === true); if (v) setIsRecurring(false) }} />
              <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-muted-foreground" /> Compra parcelada (cartão de crédito, etc.)</span>
            </label>
            {isInstallment && (
              <div className="grid gap-2.5 sm:grid-cols-2 rounded-lg border bg-muted/20 p-3">
                <Field label="Quantidade de parcelas">
                  <Input type="number" min={2} max={60} value={installmentTotal} onChange={e => setInstallmentTotal(Math.max(2, Number(e.target.value) || 2))} />
                </Field>
                <Field label="Intervalo entre parcelas (dias)">
                  <Input type="number" min={1} value={installmentInterval} onChange={e => setInstallmentInterval(Math.max(1, Number(e.target.value) || 30))} />
                </Field>
                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                  Valor por parcela: {formatCurrency(Math.round(valorCents / installmentTotal))} × {installmentTotal} (1ª parcela em {fmtDate(vencimento || competencia)}).
                </p>
              </div>
            )}

            <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setShowMore(v => !v)}>
              {showMore ? 'Ocultar informações complementares' : 'Informações complementares (opcional)'}
            </button>
            {showMore && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Número do documento"><Input value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} /></Field>
                <Field label="Nota fiscal"><Input value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} /></Field>
                <Field label="Projeto"><Input value={projeto} onChange={e => setProjeto(e.target.value)} /></Field>
                <Field label="Unidade de negócio"><Input value={unidadeNegocio} onChange={e => setUnidadeNegocio(e.target.value)} /></Field>
              </div>
            )}
          </div>

          <div className="border-l pl-4 py-2 space-y-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
            <div className="flex items-center gap-1.5">
              {tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
              <span className={cn('font-semibold tabular-nums', tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                {formatCurrency(valorCents)}
              </span>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Categoria</dt><dd className="text-right truncate">{categoria || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Vencimento</dt><dd>{fmtDate(vencimento || competencia)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd>Pendente</dd></div>
            </dl>
            {previewDates.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1 flex items-center gap-1">
                  {isInstallment ? `${installmentTotal} parcelas` : 'Próximas ocorrências'}
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                  {previewDates.slice(0, 12).map(d => <li key={d}>{fmtDate(d)}</li>)}
                  {previewDates.length > 12 && <li>+ {previewDates.length - 12} mais…</li>}
                </ul>
              </div>
            )}
            {previewDates.length > 20 && (
              <p className="text-[11px] text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Isso vai gerar {previewDates.length + 1} lançamentos.</p>
            )}
          </div>
        </div>

        <DialogFooter className="hidden md:flex">
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" disabled={creating} onClick={() => handleCreate(true)}>Salvar e criar outro</Button>
          <Button disabled={creating} onClick={() => handleCreate(false)}>{creating ? 'Criando…' : 'Criar lançamento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditEntryDialog({
  orgSlug, entry, settings, saving, open, onOpenChange, onSave, onDelete,
}: {
  orgSlug: string
  entry: FinancialEntryRow
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
  saving: boolean
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (patch: Record<string, any>) => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [e, setE] = useState<FinancialEntryRow>(entry)
  const set = (k: keyof FinancialEntryRow, v: any) => setE(prev => ({ ...prev, [k]: v }))
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [tagsText, setTagsText] = useState((entry.tags || []).join(', '))
  const [duplicating, setDuplicating] = useState(false)
  const [ocrFile, setOcrFile] = useState<File | null>(null)

  async function handleDuplicate() {
    setDuplicating(true)
    const res = await createFinancialEntry(orgSlug, {
      tipo: e.tipo, categoria: e.categoria, subcategoria: e.subcategoria, centro_custo: e.centro_custo,
      conta_bancaria: e.conta_bancaria, forma_pagamento: e.forma_pagamento, contato_id: e.contato_id,
      valor_cents: e.valor_cents, competencia: e.competencia, vencimento: e.vencimento,
      observacoes: e.observacoes,
      nota_fiscal: e.nota_fiscal, numero_documento: e.numero_documento,
      projeto: e.projeto, unidade_negocio: e.unidade_negocio,
    })
    setDuplicating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Lançamento duplicado')
    router.refresh()
  }

  const patch = () => ({
    tipo: e.tipo, categoria: e.categoria, subcategoria: e.subcategoria, centro_custo: e.centro_custo,
    conta_bancaria: e.conta_bancaria, forma_pagamento: e.forma_pagamento, valor_cents: e.valor_cents,
    competencia: e.competencia, vencimento: e.vencimento, data_pagamento: e.data_pagamento,
    status: e.status, operadora: e.operadora, observacoes: e.observacoes, contato_id: e.contato_id,
    tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
    nota_fiscal: e.nota_fiscal, numero_documento: e.numero_documento,
    projeto: e.projeto, unidade_negocio: e.unidade_negocio,
  })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadFinancialAttachment(orgSlug, e.id, fd)
        if (res.ok) set('anexos', res.anexos)
        else toast.error(`${file.name}: ${res.error}`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar anexo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
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

  async function applyExtracted(data: ExtractedFinancialDocument) {
    if (data.tipo) set('tipo', data.tipo)
    if (data.categoria_sugerida) set('categoria', data.categoria_sugerida)
    if (data.valor_cents) set('valor_cents', data.valor_cents)
    if (data.vencimento) set('vencimento', data.vencimento)
    if (data.numero_documento) set('numero_documento', data.numero_documento)
    // Lançamento já existe (estamos editando), então o anexo lido pode ser
    // salvo direto — diferente do fluxo de criação, que precisa esperar o
    // lançamento existir antes de subir o arquivo.
    if (ocrFile) {
      const fd = new FormData()
      fd.append('file', ocrFile)
      const res = await uploadFinancialAttachment(orgSlug, e.id, fd)
      if (res.ok) set('anexos', res.anexos)
      else toast.error(`Anexo não pôde ser salvo: ${res.error}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="flex items-center gap-2 truncate">
              {e.tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success shrink-0" /> : <TrendingDown className="w-4 h-4 text-destructive shrink-0" />}
              <span className="truncate">{e.categoria || 'Editar lançamento'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-7 h-7" disabled={duplicating} onClick={handleDuplicate} aria-label="Duplicar" title="Duplicar lançamento">
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir" title="Excluir lançamento">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <TipoToggle value={e.tipo} onChange={v => set('tipo', v)} />

          <Field label="Observações / descrição"><Textarea rows={2} value={e.observacoes || ''} onChange={ev => set('observacoes', ev.target.value)} /></Field>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Categoria">
              <SettingSelect value={e.categoria} onChange={v => set('categoria', v)} options={withExtra(settings.categoria, e.categoria)} required placeholder="Selecione a categoria" />
            </Field>
            <Field label="Subcategoria">
              <SettingSelect value={e.subcategoria} onChange={v => set('subcategoria', v)} options={withExtra(settings.subcategoria, e.subcategoria)} />
            </Field>
            <Field label="Centro de custo">
              <SettingSelect value={e.centro_custo} onChange={v => set('centro_custo', v)} options={withExtra(settings.centro_custo, e.centro_custo)} />
            </Field>
            <Field label="Valor"><MoneyInput value={e.valor_cents} onChange={c => set('valor_cents', c)} /></Field>
            <Field label="Competência"><Input type="date" value={e.competencia || ''} onChange={ev => set('competencia', ev.target.value)} /></Field>
            <Field label="Vencimento"><Input type="date" value={e.vencimento || ''} onChange={ev => set('vencimento', ev.target.value)} /></Field>
            <Field label="Data de pagamento"><Input type="date" value={e.data_pagamento || ''} onChange={ev => set('data_pagamento', ev.target.value)} /></Field>
            <Field label="Conta bancária">
              <SettingSelect value={e.conta_bancaria} onChange={v => set('conta_bancaria', v)} options={withExtra(settings.conta_bancaria, e.conta_bancaria)} />
            </Field>
            <Field label="Forma de pagamento">
              <SettingSelect value={e.forma_pagamento} onChange={v => set('forma_pagamento', v)} options={withExtra(settings.forma_pagamento, e.forma_pagamento)} />
            </Field>
            <Field label="Operadora">
              <SettingSelect value={e.operadora} onChange={v => set('operadora', v)} options={withExtra(settings.operadora, e.operadora)} />
            </Field>
            <Field label="Status">
              <Select value={e.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {(e.is_recurring || e.installment_group_id) && (
            <div className="rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
              {e.is_recurring && <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Faz parte de uma série recorrente.</span>}
              {e.installment_group_id && <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Parcela {e.parcela_numero}/{e.parcela_total}.</span>}
              <span className="ml-auto">Edite só esta ocorrência — as demais da série não são afetadas.</span>
            </div>
          )}

          <Field label="Cliente ou fornecedor">
            <LeadCombobox orgSlug={orgSlug} name="contato_id" placeholder="Buscar contato…" onChange={lead => set('contato_id', lead?.id ?? null)} />
          </Field>

          <Field label="Tags (separadas por vírgula)">
            <Input value={tagsText} onChange={ev => setTagsText(ev.target.value)} placeholder="ex.: urgente, reembolsável" />
          </Field>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Número do documento"><Input value={e.numero_documento || ''} onChange={ev => set('numero_documento', ev.target.value)} /></Field>
            <Field label="Nota fiscal"><Input value={e.nota_fiscal || ''} onChange={ev => set('nota_fiscal', ev.target.value)} /></Field>
            <Field label="Projeto"><Input value={e.projeto || ''} onChange={ev => set('projeto', ev.target.value)} /></Field>
            <Field label="Unidade de negócio"><Input value={e.unidade_negocio || ''} onChange={ev => set('unidade_negocio', ev.target.value)} /></Field>
          </div>

          <Field label="Anexos">
            <div className="space-y-2">
              {e.anexos?.length > 0 && (
                <ul className="space-y-1.5">
                  {e.anexos.map((a, i) => {
                    const isPdf = a.mime_type === 'application/pdf'
                    const key = a.storage_object_id ?? a.path
                    return (
                      <li key={`${key}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                        {isPdf ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                        <button type="button" onClick={() => handleOpenAttachment(key!)} className="flex-1 min-w-0 truncate text-left text-xs text-foreground hover:underline">
                          {a.name}
                        </button>
                        <button type="button" onClick={() => handleRemoveAttachment(key!)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover anexo">
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

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Ler novo documento com IA</summary>
                <div className="pt-2">
                  <FinancialDocumentPanel
                    orgSlug={orgSlug}
                    file={ocrFile}
                    onFileSelected={setOcrFile}
                    onExtracted={applyExtracted}
                  />
                </div>
              </details>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={() => onSave(patch())}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
