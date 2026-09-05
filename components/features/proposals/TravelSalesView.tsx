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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import {
  updateTravelSale, saveTravelSaleAndGenerateTasks, deleteTravelSale, createTravelSale,
  type TravelSaleRow,
} from '@/actions/travel-sales'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import { toast } from 'sonner'
import {
  MapPin, Calendar, Receipt, Plus, Search, UserCircle2, Building2, Ticket,
} from 'lucide-react'
import { FOCUS_RING, type ProposalOption, type LeadOption, type Member, type Voucher } from './TravelSalesViewShared'
import NewSaleDialog from './TravelSalesViewNewSaleDialog'
import SaleEditor from './TravelSalesViewSaleEditor'

export default function TravelSalesView({
  orgSlug, sales, proposals = [], members = [], leads = [], initialSelectedId, headerAction,
}: {
  orgSlug: string
  sales: TravelSaleRow[]
  proposals?: ProposalOption[]
  members?: Member[]
  leads?: LeadOption[]
  initialSelectedId?: string | null
  /** Botão extra (ex.: "Configurar contrato padrão"), alinhado na mesma linha dos filtros. */
  headerAction?: React.ReactNode
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(
    (initialSelectedId && sales.some(s => s.id === initialSelectedId) ? initialSelectedId : sales[0]?.id) ?? null,
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pickedProposal, setPickedProposal] = useState<string>('none')
  const [pickedContato, setPickedContato] = useState<string>('')
  const [voucherResult, setVoucherResult] = useState<{ voucher: Voucher; extracted: ExtractedTravelDocument | null } | null>(null)

  const [query, setQuery] = useState('')
  const [seller, setSeller] = useState<string>('all')
  const [dateBucket, setDateBucket] = useState<DateBucket>('all')

  const sellerName = useMemo(
    () => new Map(members.map(m => [m.user_id, m.name])),
    [members],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sales.filter(s => {
      if (seller !== 'all' && s.created_by !== seller) return false
      if (!matchesDateBucket(s.created_at, dateBucket)) return false
      if (q) {
        const hay = [s.client_name, s.destination, s.hotel_name, s.airline, s.sale_number, s.package_locator]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [sales, query, seller, dateBucket])

  const selected = sales.find(s => s.id === selectedId) ?? null

  async function handleDelete(id: string) {
    const res = await deleteTravelSale(orgSlug, id)
    if (res.ok) {
      toast.success('Venda excluída')
      if (selectedId === id) setSelectedId(null)
      router.refresh()
    } else toast.error(res.error)
  }

  async function handleCreate() {
    if (!pickedContato) { toast.error('Selecione o cliente (contato do CRM)'); return }
    setCreating(true)
    const res = await createTravelSale(
      orgSlug,
      pickedProposal === 'none' ? null : pickedProposal,
      pickedContato,
      voucherResult ? { extracted: voucherResult.extracted, voucher: voucherResult.voucher } : undefined,
    )
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }

    setNewOpen(false)
    setPickedProposal('none')
    setPickedContato('')
    setVoucherResult(null)
    toast.success('Venda criada')
    setSelectedId(res.data.id)
    router.refresh()
  }

  function handlePickProposal(v: string) {
    setPickedProposal(v)
    const proposal = proposals.find(p => p.id === v)
    if (proposal?.contato_id) setPickedContato(proposal.contato_id)
  }

  async function handleSave(id: string, patch: Record<string, any>, generate: boolean) {
    setSaving(true)
    const res = generate
      ? await saveTravelSaleAndGenerateTasks(orgSlug, id, patch)
      : await updateTravelSale(orgSlug, id, patch)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    if (generate) {
      const r = res as any
      if (r.alreadyGenerated) toast.info('As tarefas dessa venda já haviam sido geradas.')
      else toast.success(`Venda salva e ${r.tasksCreated} tarefa(s) criada(s).`)
    } else {
      toast.success('Venda salva')
    }
    router.refresh()
  }

  if (sales.length === 0) {
    return (
      <>
        <div className="flex items-center justify-end gap-2 mb-4">
          {headerAction}
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova venda
          </Button>
        </div>
        <EmptyState
          icon={Receipt}
          title="Nenhuma venda de viagem ainda"
          description="Crie uma venda manualmente com o botão 'Nova venda' (importando uma proposta), ou mova um lead com proposta vinculada para a etapa 'Fechado' no pipeline — a venda é gerada automaticamente."
        />
        <NewSaleDialog
          orgSlug={orgSlug}
          open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) { setPickedProposal('none'); setPickedContato(''); setVoucherResult(null) } }}
          proposals={proposals} picked={pickedProposal} setPicked={handlePickProposal}
          leads={leads} pickedContato={pickedContato} setPickedContato={setPickedContato}
          voucherResult={voucherResult} setVoucherResult={setVoucherResult}
          creating={creating} onCreate={handleCreate}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Filters — tudo numa linha só (encolhe/quebra no mobile). Some no
          mobile quando uma reserva está aberta: só fazem sentido na busca. */}
      <div className={cn('flex items-center gap-1.5 mb-4 flex-wrap shrink-0', selected && 'hidden md:flex')}>
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por cliente, destino, hotel, cia, ID…"
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

        {headerAction}

        <Button onClick={() => setNewOpen(true)} className="h-9 px-2.5 text-xs shrink-0">
          <Plus className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Nova venda</span>
        </Button>
      </div>

      <div className={cn(
        'grid md:grid-cols-[320px_1fr] gap-4 flex-1 min-h-0',
      )}>
        {/* ── List ─────────────────────────────────────────────── */}
        <div className={cn(
          'rounded-none border bg-card overflow-y-auto divide-y h-full',
          selected && 'hidden md:block',
        )}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma venda encontrada com esses filtros.
            </div>
          ) : filtered.map(s => {
            const active = s.id === selectedId
            const seller = s.created_by ? sellerName.get(s.created_by) : null
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'w-full text-left p-3 transition-colors',
                  FOCUS_RING,
                  active ? 'bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-[15px] leading-tight truncate">
                    {s.client_name || 'Cliente'}
                  </span>
                  {s.created_at && (
                    <span className="shrink-0 text-[10px] text-muted-foreground/70 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {(s.destination || s.departure_date || s.return_date) && (
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {s.destination && (
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{s.destination}</span>
                      </span>
                    )}
                    {(s.departure_date || s.return_date) && (
                      <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {s.departure_date ? new Date(s.departure_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : '—'}
                        {' a '}
                        {s.return_date ? new Date(s.return_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }) : '—'}
                      </span>
                    )}
                  </div>
                )}
                {(s.operator || s.package_locator || seller) && (
                  <div className="mt-1 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                    {s.operator && (
                      <span className="flex items-center gap-1 min-w-0 truncate" title={`Operadora: ${s.operator}`}>
                        <Building2 className="w-3 h-3 shrink-0 opacity-70" /> <span className="truncate">{s.operator}</span>
                      </span>
                    )}
                    {s.package_locator && (
                      <span className="flex items-center gap-1 min-w-0 truncate font-mono" title={`Localizador: ${s.package_locator}`}>
                        <Ticket className="w-3 h-3 shrink-0 opacity-70 font-sans" /> <span className="truncate">{s.package_locator}</span>
                      </span>
                    )}
                    {seller && (
                      <span className="flex items-center gap-1 min-w-0 truncate" title={`Responsável: ${seller}`}>
                        <UserCircle2 className="w-3 h-3 shrink-0 opacity-70" /> <span className="truncate">{seller}</span>
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Detail ───────────────────────────────────────────── */}
        <div className={cn(
          'rounded-none border bg-card overflow-y-auto h-full',
          !selected && 'hidden md:flex',
        )}>
          {selected
            ? <SaleEditor
                key={selected.id}
                orgSlug={orgSlug}
                sale={selected}
                saving={saving}
                sellerName={selected.created_by ? sellerName.get(selected.created_by) ?? null : null}
                leads={leads}
                onBack={() => setSelectedId(null)}
                onDelete={() => setDeleteId(selected.id)}
                onSave={(patch, generate) => handleSave(selected.id, patch, generate)}
              />
            : (
              <div className="m-auto text-center text-sm text-muted-foreground p-8">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Selecione uma venda para ver os detalhes.
              </div>
            )}
        </div>
      </div>

      <NewSaleDialog
        orgSlug={orgSlug}
        open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) { setPickedProposal('none'); setPickedContato(''); setVoucherResult(null) } }}
        proposals={proposals} picked={pickedProposal} setPicked={handlePickProposal}
        leads={leads} pickedContato={pickedContato} setPickedContato={setPickedContato}
        voucherResult={voucherResult} setVoucherResult={setVoucherResult}
        creating={creating} onCreate={handleCreate}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. As tarefas já criadas não serão removidas.</AlertDialogDescription>
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
