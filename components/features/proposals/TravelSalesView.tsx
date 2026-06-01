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
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import {
  updateTravelSale, saveTravelSaleAndGenerateTasks, deleteTravelSale, createTravelSale, type TravelSaleRow,
} from '@/actions/travel-sales'
import { toast } from 'sonner'
import {
  MapPin, CheckCircle2, ListChecks, Trash2, ArrowLeft, Receipt, Plus, FileText, Search, UserCircle2,
} from 'lucide-react'

type ProposalOption = { id: string; title: string | null; client_name: string | null }
type Member = { user_id: string; name: string; email: string }

const SERVICE_LABELS: Record<string, string> = {
  transfer: 'Traslado', insurance: 'Seguro viagem', car_rental: 'Locação de carro',
}

function centsToReais(c?: number | null) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
function fmtTimestamp(d?: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }

function MoneyInput({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input inputMode="decimal" placeholder="R$ 0,00" value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }} />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>
}

export default function TravelSalesView({
  orgSlug, sales, proposals = [], members = [],
}: {
  orgSlug: string
  sales: TravelSaleRow[]
  proposals?: ProposalOption[]
  members?: Member[]
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(sales[0]?.id ?? null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pickedProposal, setPickedProposal] = useState<string>('none')

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
        const hay = [s.client_name, s.destination, s.hotel_name, s.airline]
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
    setCreating(true)
    const res = await createTravelSale(orgSlug, pickedProposal === 'none' ? null : pickedProposal)
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }
    setNewOpen(false)
    setPickedProposal('none')
    toast.success('Venda criada')
    setSelectedId(res.data.id)
    router.refresh()
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
        <div className="flex items-center justify-end mb-4">
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
          open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) setPickedProposal('none') }}
          proposals={proposals} picked={pickedProposal} setPicked={setPickedProposal}
          creating={creating} onCreate={handleCreate}
        />
      </>
    )
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por cliente, destino, hotel, cia…"
              className="pl-8"
            />
          </div>
          {members.length > 0 && (
            <Select value={seller} onValueChange={setSeller}>
              <SelectTrigger className="w-[180px]">
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
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova venda
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_BUCKETS.map(b => (
            <button
              key={b.id}
              onClick={() => setDateBucket(b.id)}
              className={cn(
                'px-3 h-7 rounded-full border text-xs font-medium transition-colors',
                dateBucket === b.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-2">{filtered.length} de {sales.length} venda(s)</p>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100dvh-19rem)] min-h-[440px]">
        {/* ── List ─────────────────────────────────────────────── */}
        <div className={cn(
          'rounded-xl border bg-card overflow-y-auto divide-y',
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
                  active ? 'bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm leading-tight truncate">
                    {s.client_name || 'Cliente'}
                  </span>
                  {s.tasks_generated_at
                    ? <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">Tarefas</Badge>
                    : <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}
                </div>
                {s.destination && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{s.destination}</span>
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatCurrency(s.total_cents || 0)}</span>
                  <span className="text-[11px] text-muted-foreground">{fmtTimestamp(s.created_at)}</span>
                </div>
                {seller && (
                  <div className="mt-1.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal gap-1">
                      <UserCircle2 className="w-3 h-3" /> {seller}
                    </Badge>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Detail ───────────────────────────────────────────── */}
        <div className={cn(
          'rounded-xl border bg-card overflow-y-auto',
          !selected && 'hidden md:flex',
        )}>
          {selected
            ? <SaleEditor
                key={selected.id}
                sale={selected}
                saving={saving}
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
        open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) setPickedProposal('none') }}
        proposals={proposals} picked={pickedProposal} setPicked={setPickedProposal}
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
    </>
  )
}

function NewSaleDialog({
  open, onOpenChange, proposals, picked, setPicked, creating, onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  proposals: ProposalOption[]
  picked: string
  setPicked: (v: string) => void
  creating: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nova venda de viagem</DialogTitle>
          <DialogDescription>
            Importe uma proposta para preencher os dados automaticamente, ou comece em branco.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <Label className="text-xs">Importar de uma proposta</Label>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma proposta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Começar em branco</SelectItem>
              {proposals.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {(p.title || 'Proposta sem título')}{p.client_name ? ` · ${p.client_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {proposals.length === 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Nenhuma proposta criada ainda — a venda começará em branco.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={creating} onClick={onCreate}>
            {creating ? 'Criando…' : 'Criar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SaleEditor({
  sale, saving, onSave, onBack, onDelete,
}: {
  sale: TravelSaleRow
  saving: boolean
  onSave: (patch: Record<string, any>, generate: boolean) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [s, setS] = useState<TravelSaleRow>(sale)
  const set = (k: keyof TravelSaleRow, v: any) => setS(prev => ({ ...prev, [k]: v }))
  const services: string[] = Array.isArray(s.services) ? s.services : []

  const patch = () => ({
    client_name: s.client_name, destination: s.destination,
    departure_date: s.departure_date || null, return_date: s.return_date || null,
    negotiation_days: s.negotiation_days, total_cents: s.total_cents,
    hotel_name: s.hotel_name, airline: s.airline, payment_method: s.payment_method,
    package_locator: s.package_locator, air_locator: s.air_locator,
    airline_checkin_url: s.airline_checkin_url, commission_cents: s.commission_cents,
    notes: s.notes,
  })

  return (
    <div className="flex flex-col w-full">
      {/* header */}
      <div className="sticky top-0 bg-card/90 backdrop-blur border-b p-4 flex items-center gap-3 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary shrink-0" /> {s.client_name || 'Venda de viagem'}
            </h2>
            {s.tasks_generated_at
              ? <Badge variant="outline" className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">Tarefas geradas</Badge>
              : <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Auto-filled (editable) */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados da viagem (pré-preenchidos)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cliente"><Input value={s.client_name || ''} onChange={e => set('client_name', e.target.value)} /></Field>
            <Field label="Destino"><Input value={s.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
            <Field label="Data de ida"><Input type="date" value={s.departure_date || ''} onChange={e => set('departure_date', e.target.value)} /></Field>
            <Field label="Data de volta"><Input type="date" value={s.return_date || ''} onChange={e => set('return_date', e.target.value)} /></Field>
            <Field label="Hotel"><Input value={s.hotel_name || ''} onChange={e => set('hotel_name', e.target.value)} /></Field>
            <Field label="Companhia aérea"><Input value={s.airline || ''} onChange={e => set('airline', e.target.value)} /></Field>
            <Field label="Valor total"><MoneyInput value={s.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
            <Field label="Forma de pagamento"><Input value={s.payment_method || ''} onChange={e => set('payment_method', e.target.value)} /></Field>
            <Field label="Tempo de negociação (dias)"><Input type="number" min="0" value={s.negotiation_days ?? ''} onChange={e => set('negotiation_days', e.target.value ? parseInt(e.target.value) : null)} /></Field>
          </div>
          {services.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {services.map(k => <Badge key={k} variant="secondary">{SERVICE_LABELS[k] || k}</Badge>)}
            </div>
          )}
        </div>

        {/* Manual fields */}
        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Dados operacionais (preencha manualmente)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Localizador do pacote"><Input value={s.package_locator || ''} onChange={e => set('package_locator', e.target.value)} placeholder="Ex.: PKG-12345" /></Field>
            <Field label="Localizador aéreo"><Input value={s.air_locator || ''} onChange={e => set('air_locator', e.target.value)} placeholder="Ex.: ABC123" /></Field>
            <Field label="Link de check-in da cia (opcional)"><Input value={s.airline_checkin_url || ''} onChange={e => set('airline_checkin_url', e.target.value)} placeholder="https://..." /></Field>
            <Field label="Comissão"><MoneyInput value={s.commission_cents || 0} onChange={c => set('commission_cents', c)} /></Field>
          </div>
        </div>

        <Field label="Observações"><Textarea value={s.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>

        {s.tasks_generated_at && (
          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Tarefas operacionais já geradas para esta venda.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Button variant="outline" disabled={saving} onClick={() => onSave(patch(), false)}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button disabled={saving || !!s.tasks_generated_at} onClick={() => onSave(patch(), true)}>
            <ListChecks className="w-4 h-4 mr-1.5" /> {saving ? 'Processando…' : 'Salvar e gerar tarefas'}
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 ml-auto" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
          </Button>
        </div>
      </div>
    </div>
  )
}
