'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { uploadSaleVoucher } from '@/actions/upload'
import { toast } from 'sonner'
import {
  MapPin, CheckCircle2, ListChecks, Trash2, ArrowLeft, Receipt, Plus, FileText, Search, UserCircle2,
  ExternalLink, Paperclip, Upload, X, Loader2, FileIcon, ImageIcon, Users, Save,
} from 'lucide-react'

type ProposalOption = { id: string; title: string | null; client_name: string | null }
type Member = { user_id: string; name: string; email: string }
type Voucher = { url: string; name: string }

const SERVICE_LABELS: Record<string, string> = {
  transfer: 'Traslado', insurance: 'Seguro viagem', car_rental: 'Locação de carro',
}

const PAYMENT_METHODS = ['Pix', 'Cartão de crédito', 'Boleto'] as const

const INCLUDED_ITEMS: { key: string; label: string }[] = [
  { key: 'voos', label: 'Voos' },
  { key: 'hospedagem', label: 'Hospedagem' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'seguro', label: 'Seguro viagem' },
  { key: 'passeios', label: 'Passeios' },
  { key: 'carros', label: 'Locação de carro' },
]

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
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
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
      <div className="flex flex-col gap-2 mb-4">
        {/* Search on its own row so the buttons never overlap it on mobile. */}
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por cliente, destino, hotel, cia…"
            className="pl-8 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {/* Time filter: dropdown on mobile, pills on desktop. */}
          <select
            value={dateBucket}
            onChange={e => setDateBucket(e.target.value as DateBucket)}
            className="sm:hidden h-8 flex-1 min-w-0 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground"
          >
            {DATE_BUCKETS.map(b => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>

          {members.length > 0 && (
            <Select value={seller} onValueChange={setSeller}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:flex-none sm:w-[170px]">
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
          <Button onClick={() => setNewOpen(true)} className="h-8 px-2.5 text-xs shrink-0">
            <Plus className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Nova venda</span>
          </Button>
        </div>

        {/* Date pills — desktop only. */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5">
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
                  <div className="mt-1.5 flex">
                    <Badge variant="secondary" className="max-w-full text-[10px] px-1.5 py-0 font-normal gap-1">
                      <UserCircle2 className="w-3 h-3 shrink-0" /> <span className="truncate">{seller}</span>
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
                orgSlug={orgSlug}
                sale={selected}
                saving={saving}
                sellerName={selected.created_by ? sellerName.get(selected.created_by) ?? null : null}
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
  orgSlug, sale, saving, sellerName, onSave, onBack, onDelete,
}: {
  orgSlug: string
  sale: TravelSaleRow
  saving: boolean
  sellerName: string | null
  onSave: (patch: Record<string, any>, generate: boolean) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [s, setS] = useState<TravelSaleRow>(sale)
  const set = (k: keyof TravelSaleRow, v: any) => setS(prev => ({ ...prev, [k]: v }))
  const services: string[] = Array.isArray(s.services) ? s.services : []
  const included: string[] = Array.isArray(s.included_items) ? s.included_items : []
  const vouchers: Voucher[] = Array.isArray(s.vouchers) ? s.vouchers : []
  const travelers: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(s.travelers) ? s.travelers : []

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  function toggleIncluded(key: string) {
    set('included_items', included.includes(key)
      ? included.filter(k => k !== key)
      : [...included, key])
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const next: Voucher[] = [...vouchers]
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadSaleVoucher(orgSlug, fd)
      if (res.ok) next.push({ url: res.url, name: res.name })
      else toast.error(`${file.name}: ${res.error}`)
    }
    setUploading(false)
    set('vouchers', next)
    if (fileRef.current) fileRef.current.value = ''
  }

  const patch = () => ({
    client_name: s.client_name, destination: s.destination,
    departure_date: s.departure_date || null, return_date: s.return_date || null,
    negotiation_days: s.negotiation_days, total_cents: s.total_cents,
    hotel_name: s.hotel_name, airline: s.airline, operator: s.operator,
    payment_method: s.payment_method, included_items: included, vouchers,
    travelers, travelers_note: s.travelers_note,
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
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold truncate flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary shrink-0" /> {s.client_name || 'Venda de viagem'}
            </h2>
            {s.tasks_generated_at
              ? <Badge variant="outline" className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">Tarefas geradas</Badge>
              : <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}
            {s.proposal_id && (
              <Link
                href={`/app/${orgSlug}/cotacoes/${s.proposal_id}`}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ver proposta
              </Link>
            )}
          </div>
          {sellerName && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <UserCircle2 className="w-3.5 h-3.5" /> Vendedor: <span className="font-medium text-foreground">{sellerName}</span>
            </p>
          )}
        </div>

        {/* Actions relocated from the bottom of the form into the header bar */}
        <div className="shrink-0 flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave(patch(), false)} title="Salvar" aria-label="Salvar">
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          <Button size="sm" disabled={saving || !!s.tasks_generated_at} onClick={() => onSave(patch(), true)} title="Salvar e gerar tarefas" aria-label="Salvar e gerar tarefas">
            <ListChecks className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Processando…' : 'Salvar e gerar tarefas'}</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir" title="Excluir venda">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Auto-filled (editable) */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dados da viagem (pré-preenchidos)</p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Cliente"><Input value={s.client_name || ''} onChange={e => set('client_name', e.target.value)} /></Field>
            <Field label="Destino"><Input value={s.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
            <Field label="Valor total"><MoneyInput value={s.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
            <Field label="Data de ida"><Input type="date" value={s.departure_date || ''} onChange={e => set('departure_date', e.target.value)} /></Field>
            <Field label="Data de volta"><Input type="date" value={s.return_date || ''} onChange={e => set('return_date', e.target.value)} /></Field>
            <Field label="Tempo de negociação (dias)"><Input type="number" min="0" value={s.negotiation_days ?? ''} onChange={e => set('negotiation_days', e.target.value ? parseInt(e.target.value) : null)} /></Field>
            <Field label="Hotel"><Input value={s.hotel_name || ''} onChange={e => set('hotel_name', e.target.value)} /></Field>
            <Field label="Companhia aérea"><Input value={s.airline || ''} onChange={e => set('airline', e.target.value)} /></Field>
            <Field label="Operadora"><Input value={s.operator || ''} onChange={e => set('operator', e.target.value)} placeholder="Ex.: CVC, Azul Viagens…" /></Field>
          </div>
        </div>

        {/* Viajantes */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Viajantes</p>
          </div>
          <div className="space-y-2">
            {travelers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border bg-background/40 p-2">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Nome completo</Label>
                  <Input placeholder="Nome completo" value={t.name || ''}
                    onChange={e => { const n = [...travelers]; n[i] = { ...n[i], name: e.target.value }; set('travelers', n) }} />
                </div>
                <div className="w-36 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Data de nascimento</Label>
                  <Input type="date" value={t.birth_date || ''}
                    onChange={e => { const n = [...travelers]; n[i] = { ...n[i], birth_date: e.target.value }; set('travelers', n) }} />
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">CPF</Label>
                  <Input placeholder="000.000.000-00" inputMode="numeric" value={t.cpf || ''}
                    onChange={e => { const n = [...travelers]; n[i] = { ...n[i], cpf: e.target.value }; set('travelers', n) }} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => set('travelers', travelers.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set('travelers', [...travelers, { name: '', birth_date: '', cpf: '' }])}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar viajante
            </Button>
          </div>
        </div>

        {/* Forma de pagamento — 3 selectable buttons */}
        <Field label="Forma de pagamento">
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_METHODS.map(m => {
              const active = s.payment_method === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('payment_method', active ? null : m)}
                  className={cn(
                    'px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border',
                  )}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Itens inclusos na negociação — checkboxes */}
        <Field label="Itens inclusos na negociação">
          <div className="flex flex-wrap gap-1.5">
            {INCLUDED_ITEMS.map(item => {
              const active = included.includes(item.key)
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleIncluded(item.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
                    active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border',
                  )}
                >
                  {active && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {item.label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Vouchers — multiple PDF/image upload */}
        <Field label="Vouchers / comprovantes">
          <div className="space-y-2">
            {vouchers.length > 0 && (
              <ul className="space-y-1.5">
                {vouchers.map((v, i) => {
                  const isPdf = /\.pdf($|\?)/i.test(v.url) || /\.pdf$/i.test(v.name)
                  return (
                    <li key={`${v.url}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                      {isPdf
                        ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" />
                        : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                      <a href={v.url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 min-w-0 truncate text-xs text-foreground hover:underline">
                        {v.name || `Voucher ${i + 1}`}
                      </a>
                      <button
                        type="button"
                        onClick={() => set('vouchers', vouchers.filter((_, idx) => idx !== i))}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remover voucher"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <Button
              type="button" variant="outline" size="sm" disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</>
                : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Adicionar vouchers</>}
            </Button>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Paperclip className="w-3 h-3" /> PDF ou imagem, até 15 MB cada. Vários arquivos permitidos.
            </p>
          </div>
        </Field>

        {services.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {services.map(k => <Badge key={k} variant="secondary">{SERVICE_LABELS[k] || k}</Badge>)}
          </div>
        )}

        {/* Manual fields */}
        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-2">Dados operacionais (preencha manualmente)</p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Localizador do pacote"><Input value={s.package_locator || ''} onChange={e => set('package_locator', e.target.value)} placeholder="Ex.: PKG-12345" /></Field>
            <Field label="Localizador aéreo"><Input value={s.air_locator || ''} onChange={e => set('air_locator', e.target.value)} placeholder="Ex.: ABC123" /></Field>
            <Field label="Comissão"><MoneyInput value={s.commission_cents || 0} onChange={c => set('commission_cents', c)} /></Field>
          </div>
        </div>

        <Field label="Observações"><Textarea rows={2} value={s.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>

        {s.tasks_generated_at && (
          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Tarefas operacionais já geradas para esta venda.
          </p>
        )}
      </div>
    </div>
  )
}
