'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/ui/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn, formatCurrency } from '@/lib/utils'
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import { createProposal, deleteProposal, type ProposalRow } from '@/actions/travel-proposals'
import { toast } from 'sonner'
import { FileSignature, Plus, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { fmtTimestamp, fmtDate, destOf, sellerLabelColor, proposalStatusMeta } from './ProposalsListHelpers'
import { ProposalRowActions } from './ProposalsListRowActions'
import { DuplicateProposalDialog } from './ProposalsListDuplicateDialog'

type Member = { user_id: string; name: string; email: string }
type Contato = { id: string; name: string }

export default function ProposalsList({
  orgSlug,
  proposals,
  members = [],
  contatos = [],
}: {
  orgSlug: string
  proposals: ProposalRow[]
  members?: Member[]
  contatos?: Contato[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [duplicateFor, setDuplicateFor] = useState<ProposalRow | null>(null)

  const [query, setQuery] = useState('')
  const [seller, setSeller] = useState<string>('all')
  const [dateBucket, setDateBucket] = useState<DateBucket>('all')

  const sellerName = useMemo(
    () => new Map(members.map(m => [m.user_id, m.name])),
    [members],
  )

  const hasActiveFilters = seller !== 'all' || dateBucket !== 'all'
  function clearFilters() { setSeller('all'); setDateBucket('all') }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return proposals.filter(p => {
      if (seller !== 'all' && p.created_by !== seller) return false
      if (!matchesDateBucket(p.created_at, dateBucket)) return false
      if (q) {
        const hay = [
          p.client_name, p.title, destOf(p),
          ...(Array.isArray(p.travelers) ? p.travelers.map((t: any) => t?.name) : []),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [proposals, query, seller, dateBucket])

  async function handleCreate() {
    setCreating(true)
    const res = await createProposal(orgSlug, {})
    setCreating(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao criar proposta'); return }
    router.push(`/app/${orgSlug}/cotacoes/${res.data.id}`)
  }

  async function handleDelete(id: string) {
    const res = await deleteProposal(orgSlug, id)
    if (res.ok) {
      toast.success('Proposta excluída')
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Nenhuma proposta ainda"
        description="Crie sua primeira proposta de viagem com voos, hospedagem, serviços e condições de pagamento."
      >
        <Button size="lg" className="mt-4" onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? 'Criando…' : 'Nova proposta'}
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Filters — tudo numa linha só (encolhe/quebra no mobile), mesmo padrão de Reservas. */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por cliente, destino, título…"
            className="pl-8 h-9"
          />
        </div>

        {/* Vendedor/Período organizados num único menu "Filtros" — em vez
            de seletores soltos na barra. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)] shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
              {hasActiveFilters && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">•</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            {members.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select value={seller} onValueChange={setSeller}>
                  <SelectTrigger className="h-9 text-xs w-full"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Período</Label>
              <ResponsiveSelect
                className="h-9 w-full text-xs"
                aria-label="Filtrar por data"
                value={dateBucket}
                onValueChange={v => setDateBucket(v as DateBucket)}
                options={DATE_BUCKETS.map(b => ({ value: b.id, label: b.label }))}
              />
            </div>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
                Limpar filtros
              </button>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <Button
          onClick={handleCreate}
          disabled={creating}
          className="h-9 px-3 text-xs shrink-0"
        >
          <Plus className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{creating ? 'Criando…' : 'Nova cotação'}</span>
        </Button>
      </div>

      {/* Tabela em tela cheia — clicar na linha abre o editor da cotação
          direto (rota /cotacoes/[id]), sem tela intermediária de prévia. */}
      <div className="flex-1 min-h-0 rounded-lg bg-card overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma proposta encontrada com esses filtros.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden lg:table-cell">Destino</TableHead>
                <TableHead className="hidden lg:table-cell whitespace-nowrap">Período</TableHead>
                <TableHead className="hidden xl:table-cell text-right whitespace-nowrap">Pessoas</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="hidden md:table-cell whitespace-nowrap">Criada em</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const dest = destOf(p)
                const seller = p.created_by ? sellerName.get(p.created_by) : null
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/app/${orgSlug}/cotacoes/${p.id}`)}
                  >
                    <TableCell className="max-w-[220px]">
                      <span className="font-medium text-sm truncate block">
                        {p.client_name || p.title || 'Proposta sem título'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[180px]">
                      {dest ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                          <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{dest}</span>
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                      {p.start_date || p.end_date
                        ? `${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-xs text-muted-foreground tabular-nums">
                      {p.pax_count ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums whitespace-nowrap">
                      {formatCurrency(p.total_cents || 0)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground whitespace-nowrap">
                      {fmtTimestamp(p.created_at)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {(() => {
                        const meta = proposalStatusMeta(p.status)
                        return (
                          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap', meta.cls)}>
                            {meta.label}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {seller ? (
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium truncate max-w-[110px]', sellerLabelColor(p.created_by))}>
                          {seller}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <ProposalRowActions
                        orgSlug={orgSlug}
                        p={p}
                        onDelete={() => setDeleteId(p.id)}
                        onDuplicate={() => setDuplicateFor(p)}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DuplicateProposalDialog
        orgSlug={orgSlug}
        proposal={duplicateFor}
        contatos={contatos}
        onClose={() => setDuplicateFor(null)}
        onDone={(newId) => { setDuplicateFor(null); router.push(`/app/${orgSlug}/cotacoes/${newId}`) }}
      />
    </div>
  )
}
