'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/ui/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn, formatCurrency } from '@/lib/utils'
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import { createProposal, deleteProposal, type ProposalRow } from '@/actions/travel-proposals'
import { toast } from 'sonner'
import { FileSignature, Plus, MapPin, Search } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { fmtTimestamp, destOf, sellerLabelColor } from './ProposalsListHelpers'
import { ProposalRowActions } from './ProposalsListRowActions'
import { ProposalDetail } from './ProposalsListDetail'
import { DuplicateProposalDialog } from './ProposalsListDuplicateDialog'

type Member = { user_id: string; name: string; email: string }
type Contato = { id: string; name: string }

export default function ProposalsList({
  orgSlug,
  proposals,
  members = [],
  contatos = [],
  onSelectionChange,
}: {
  orgSlug: string
  proposals: ProposalRow[]
  members?: Member[]
  contatos?: Contato[]
  /** Notifica o pai quando uma proposta abre/fecha, se precisar reagir. */
  onSelectionChange?: (hasSelection: boolean) => void
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [duplicateFor, setDuplicateFor] = useState<ProposalRow | null>(null)
  // Sem auto-seleção — abrir "Cotações" mostra a lista primeiro, nunca uma
  // proposta já aberta direto.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [seller, setSeller] = useState<string>('all')
  const [dateBucket, setDateBucket] = useState<DateBucket>('all')

  const sellerName = useMemo(
    () => new Map(members.map(m => [m.user_id, m.name])),
    [members],
  )

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

  const selected = proposals.find(p => p.id === selectedId) ?? null

  useEffect(() => {
    onSelectionChange?.(!!selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

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
      if (selectedId === id) setSelectedId(null)
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
      {/* Filters — tudo numa linha só (encolhe/quebra no mobile), mesmo padrão de Reservas.
          Some no mobile quando uma proposta está aberta: só fazem sentido na busca. */}
      <div className={cn('flex items-center gap-1.5 mb-4 flex-wrap shrink-0', selected && 'hidden md:flex')}>
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por cliente, destino, título…"
            className="pl-8 h-9"
          />
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

        <ResponsiveSelect
          className="h-9 w-[150px] shrink-0 text-xs"
          aria-label="Filtrar por data"
          value={dateBucket}
          onValueChange={v => setDateBucket(v as DateBucket)}
          options={DATE_BUCKETS.map(b => ({ value: b.id, label: b.label }))}
        />

        <Button
          onClick={handleCreate}
          disabled={creating}
          className="h-9 px-2.5 text-xs shrink-0"
          title="Nova proposta"
          aria-label="Nova proposta"
        >
          <Plus className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{creating ? 'Criando…' : 'Nova proposta'}</span>
        </Button>
      </div>

      <div className="grid md:grid-cols-[50fr_48fr] gap-4 flex-1 min-h-0">
        {/* ── List (tabela) ────────────────────────────────────── */}
        <div className={cn(
          'rounded-none border bg-card overflow-auto h-full',
          selected && 'hidden md:block',
        )}>
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
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="hidden md:table-cell whitespace-nowrap">Data</TableHead>
                  <TableHead className="hidden lg:table-cell">Vendedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const dest = destOf(p)
                  const active = p.id === selectedId
                  const seller = p.created_by ? sellerName.get(p.created_by) : null
                  return (
                    <TableRow
                      key={p.id}
                      className={cn('cursor-pointer', active && 'bg-primary/5')}
                      onClick={() => setSelectedId(p.id)}
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
                      <TableCell className="text-right text-xs font-medium tabular-nums whitespace-nowrap">
                        {formatCurrency(p.total_cents || 0)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground whitespace-nowrap">
                        {fmtTimestamp(p.created_at)}
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
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ── Detail ───────────────────────────────────────────── */}
        <div className={cn(
          'rounded-none border bg-card overflow-y-auto h-full',
          !selected && 'hidden md:flex',
        )}>
          {selected
            ? <ProposalDetail
                key={selected.id}
                orgSlug={orgSlug}
                p={selected}
                sellerName={selected.created_by ? sellerName.get(selected.created_by) ?? null : null}
                onBack={() => setSelectedId(null)}
                onDuplicate={() => setDuplicateFor(selected)}
              />
            : (
              <div className="m-auto text-center text-sm text-muted-foreground p-8">
                <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Selecione uma proposta para ver os detalhes.
              </div>
            )}
        </div>
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
        onDone={(newId) => { setDuplicateFor(null); setSelectedId(newId); router.refresh() }}
      />
    </div>
  )
}
