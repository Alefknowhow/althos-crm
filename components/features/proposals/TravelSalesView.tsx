'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import {
  updateTravelSale, saveTravelSaleAndGenerateTasks, deleteTravelSale, createTravelSale,
  getContatoTravelerInfo, listSaleOperatorOptions, type TravelSaleRow, type FlightSegment,
} from '@/actions/travel-sales'
import { listSaleProducts, createSaleProduct, deleteSaleProduct, type SaleProduct } from '@/actions/sale-products'
import CancelTravelSaleDialog from '@/components/features/reservas/CancelTravelSaleDialog'
import ContratoManagerDialog from '@/components/features/reservas/ContratoManagerDialog'
import ApplyCreditDialog from '@/components/features/reservas/ApplyCreditDialog'
import SaleTasksList from '@/components/features/reservas/SaleTasksList'
import SaleProductsTab from '@/components/features/reservas/SaleProductsTab'
import VoucherUploadAndReview from '@/components/features/reservas/VoucherUploadAndReview'
import VoucherExtractDialog, { type ExtractSource } from '@/components/features/reservas/VoucherExtractDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  MapPin, Calendar, CheckCircle2, Trash2, ArrowLeft, Receipt, Plus, Search, UserCircle2,
  ExternalLink, Paperclip, Upload, X, Loader2, FileIcon, ImageIcon, Users, Save, Check, ChevronsUpDown,
  Ban, Wallet, FileBadge, FileSignature, Sparkles, UserPlus, Plane,
  Package, ListTodo, FolderOpen, Hotel,
} from 'lucide-react'

type ProposalOption = { id: string; title: string | null; client_name: string | null; contato_id?: string | null }
type LeadOption = { id: string; name: string; phone: string | null }
type Member = { user_id: string; name: string; email: string }
type Voucher = { url: string; name: string }

const SERVICE_LABELS: Record<string, string> = {
  transfer: 'Traslado', insurance: 'Seguro viagem', car_rental: 'Locação de carro',
}

const PAYMENT_METHODS = ['Pix', 'Cartão de crédito', 'Boleto'] as const

// Keyboard focus ring for the custom <button> filters/toggles (the design
// system zeroes the native outline).
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

const INCLUDED_ITEMS: { key: string; label: string }[] = [
  { key: 'voos', label: 'Voos' },
  { key: 'hospedagem', label: 'Hospedagem' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'cruzeiros', label: 'Cruzeiros' },
  { key: 'seguro', label: 'Seguro viagem' },
  { key: 'passeios', label: 'Passeios' },
  { key: 'carros', label: 'Locação de carro' },
  { key: 'ingressos', label: 'Ingressos' },
  { key: 'servicos', label: 'Serviços' },
]

function centsToReais(c?: number | null) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

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

/**
 * "Reter comissão": quando o cliente dá entrada à vista, a agência às vezes
 * já fica com parte (ou toda) a comissão nesse momento, em vez de esperar o
 * repasse da operadora. Esse controle só marca QUANTO disso foi retido —
 * a Comissão continua sendo o valor cheio; o Financeiro é quem usa os dois
 * números pra separar em dois lançamentos (retido na data da venda, o resto
 * na data de pagamento da operadora).
 */
function RetainedCommissionField({
  commissionCents, retainedCents, onChange,
}: {
  commissionCents: number
  retainedCents: number | null
  onChange: (v: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const active = retainedCents != null && retainedCents > 0
  const clamp = (v: number) => Math.max(0, Math.min(v, commissionCents))

  return (
    <Field label="Comissão retida na venda">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!commissionCents}
            className={cn(
              'w-full h-9 px-3 rounded-md border text-sm text-left transition-colors flex items-center justify-between',
              FOCUS_RING,
              !commissionCents
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : active
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-background hover:bg-muted text-muted-foreground',
            )}
          >
            <span>{active ? `${centsToReais(retainedCents!)} retido agora` : 'Nenhuma retenção'}</span>
            {active && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2" align="start">
          <p className="text-xs text-muted-foreground">
            Quanto da comissão ({centsToReais(commissionCents)}) já ficou com a agência na
            entrada à vista? Lançado no Financeiro na data da venda; o restante entra na data
            de pagamento da operadora.
          </p>
          <MoneyInput
            value={retainedCents || 0}
            onChange={v => onChange(clamp(v) || null)}
          />
          {retainedCents != null && retainedCents >= commissionCents && commissionCents > 0 && (
            <p className="text-[11px] text-muted-foreground">Comissão 100% retida — nada a receber da operadora.</p>
          )}
          {active && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => { onChange(null); setOpen(false) }}>
              Remover retenção
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </Field>
  )
}

// Combobox com busca por digitação — a lista de contatos pode ser grande,
// então rolar com o mouse num <select> comum não escala.
function ContactCombobox({ leads, value, onChange }: {
  leads: LeadOption[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = leads.find(l => l.id === value) || null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ''}` : 'Selecione o contato do CRM'}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(id, search) => {
            const lead = leads.find(l => l.id === id)
            if (!lead) return 0
            const haystack = `${lead.name} ${lead.phone || ''}`.toLowerCase()
            return haystack.includes(search.toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Buscar por nome ou telefone..." />
          <CommandList>
            <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
            <CommandGroup>
              {leads.map(l => (
                <CommandItem
                  key={l.id}
                  value={l.id}
                  onSelect={() => { onChange(l.id); setOpen(false) }}
                >
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === l.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{l.name}{l.phone ? ` · ${l.phone}` : ''}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

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
        const hay = [s.client_name, s.destination, s.hotel_name, s.airline, s.sale_number]
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
    const res = await createTravelSale(orgSlug, pickedProposal === 'none' ? null : pickedProposal, pickedContato)
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }

    setNewOpen(false)
    setPickedProposal('none')
    setPickedContato('')
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
          open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) { setPickedProposal('none'); setPickedContato('') } }}
          proposals={proposals} picked={pickedProposal} setPicked={handlePickProposal}
          leads={leads} pickedContato={pickedContato} setPickedContato={setPickedContato}
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
                <span className="font-medium text-[15px] leading-tight truncate block">
                  {s.client_name || 'Cliente'}
                </span>
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
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    {s.operator && <span className="truncate"><span className="opacity-70">Oper:</span> {s.operator}</span>}
                    {s.operator && s.package_locator && <span className="opacity-50">|</span>}
                    {s.package_locator && <span className="font-mono truncate"><span className="opacity-70 font-sans">Loc:</span> {s.package_locator}</span>}
                    {(s.operator || s.package_locator) && seller && <span className="opacity-50">|</span>}
                    {seller && <span className="truncate"><span className="opacity-70">Res:</span> {seller}</span>}
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
        open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) { setPickedProposal('none'); setPickedContato('') } }}
        proposals={proposals} picked={pickedProposal} setPicked={handlePickProposal}
        leads={leads} pickedContato={pickedContato} setPickedContato={setPickedContato}
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

function NewSaleDialog({
  orgSlug, open, onOpenChange, proposals, picked, setPicked, leads, pickedContato, setPickedContato,
  creating, onCreate,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  proposals: ProposalOption[]
  picked: string
  setPicked: (v: string) => void
  leads: LeadOption[]
  pickedContato: string
  setPickedContato: (v: string) => void
  creating: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nova venda de viagem</DialogTitle>
          <DialogDescription>
            Toda venda precisa estar ligada a um contato do CRM. Se o cliente ainda não foi cadastrado, cadastre-o em Contatos antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Cliente <span className="text-destructive">*</span></Label>
            <ContactCombobox leads={leads} value={pickedContato} onChange={setPickedContato} />
            {leads.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Nenhum contato cadastrado ainda — cadastre o cliente em Contatos primeiro.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Importar de uma proposta <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma proposta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem proposta — preencher manualmente</SelectItem>
                {proposals.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {(p.title || 'Proposta sem título')}{p.client_name ? ` · ${p.client_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Depois de criar, você pode enviar o voucher e autopreencher os dados com IA na tela da venda.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={creating || !pickedContato} onClick={onCreate}>
            {creating ? 'Criando…' : 'Criar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SaleEditor({
  orgSlug, sale, saving, sellerName, leads = [], onSave, onBack, onDelete,
}: {
  orgSlug: string
  sale: TravelSaleRow
  saving: boolean
  sellerName: string | null
  leads?: LeadOption[]
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
  const flights: FlightSegment[] = Array.isArray(s.flights) ? s.flights : []

  const [activeTab, setActiveTab] = useState('dados')
  const [productsRefreshKey, setProductsRefreshKey] = useState(0)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)
  const [operatorOptions, setOperatorOptions] = useState<string[]>([])
  const [extractSource, setExtractSource] = useState<ExtractSource | null>(null)
  const [extractLabel, setExtractLabel] = useState<string | null>(null)
  const [extractOpen, setExtractOpen] = useState(false)
  const [extractingUrl, setExtractingUrl] = useState<string | null>(null)

  async function handleExtractFromUrl(v: Voucher) {
    setExtractingUrl(v.url)
    try {
      const resp = await fetch(v.url)
      if (!resp.ok) throw new Error('Não foi possível baixar o arquivo.')
      const blob = await resp.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || '')
          const comma = result.indexOf(',')
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      setExtractSource({ base64, mediaType: blob.type || 'application/pdf' })
      setExtractLabel(v.name || null)
      setExtractOpen(true)
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao ler o voucher.')
    } finally {
      setExtractingUrl(null)
    }
  }

  // Política de cancelamento / informações importantes / informações de
  // serviço são texto livre em nível de venda — quando a reserva tem vários
  // vouchers (aéreo, hotel, passeio…), cada um pode trazer sua própria
  // regra. Em vez de o próximo voucher lido sobrescrever o anterior, cada
  // leitura é anexada como um bloco novo (identificado pelo nome do
  // arquivo), preservando todas as regras já capturadas.
  const APPEND_FIELDS = ['cancellation_policy', 'important_info', 'service_info'] as const
  function mergeExtractedFields(prev: TravelSaleRow, fields: Record<string, any>, sourceLabel: string | null): TravelSaleRow {
    const next: Record<string, any> = { ...fields }
    for (const key of APPEND_FIELDS) {
      if (!(key in fields) || !fields[key]) continue
      const existing = (prev as any)[key] as string | null
      const incoming = String(fields[key]).trim()
      if (existing && existing.includes(incoming)) { next[key] = existing; continue } // já foi mesclado antes
      const entry = sourceLabel ? `— ${sourceLabel} —\n${incoming}` : incoming
      next[key] = existing ? `${existing}\n\n${entry}` : entry
    }
    return { ...prev, ...next }
  }

  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    listSaleOperatorOptions(orgSlug).then(opts => { if (!cancelled) setOperatorOptions(opts) })
    return () => { cancelled = true }
  }, [orgSlug])

  function toggleIncluded(key: string) {
    set('included_items', included.includes(key)
      ? included.filter(k => k !== key)
      : [...included, key])
  }

  const patch = () => ({
    client_name: s.client_name, destination: s.destination,
    departure_date: s.departure_date || null, return_date: s.return_date || null,
    negotiation_days: s.negotiation_days, total_cents: s.total_cents,
    hotel_name: s.hotel_name, airline: s.airline, operator: s.operator,
    payment_method: s.payment_method, included_items: included, vouchers,
    travelers, travelers_note: s.travelers_note,
    package_locator: s.package_locator, air_locator: s.air_locator, hotel_locator: s.hotel_locator,
    airline_checkin_url: s.airline_checkin_url, commission_cents: s.commission_cents,
    retained_commission_cents: s.retained_commission_cents,
    notes: s.notes, cancellation_policy: s.cancellation_policy, important_info: s.important_info,
    service_info: s.service_info, flights,
  })

  function handleSaveClick() { onSave(patch(), false) }

  const period = (s.departure_date || s.return_date)
    ? `${s.departure_date ? new Date(s.departure_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'} → ${s.return_date ? new Date(s.return_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}`
    : null

  return (
    <div className="flex flex-col w-full">
      {/* Header — tudo numa linha só, sem segunda linha só pra botões. */}
      <div className="sticky top-0 bg-card/90 border-b p-3 sm:p-4 flex items-center gap-3 z-10 flex-wrap">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate text-[15px] flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-primary shrink-0" /> {s.client_name || 'Venda de viagem'}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {s.destination && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" /> {s.destination}
              </span>
            )}
            {period && <span>{period}</span>}
            {sellerName && <span>Vendedor: {sellerName}</span>}
            {s.proposal_id && (
              <Link href={`/app/${orgSlug}/cotacoes/${s.proposal_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> Ver proposta
              </Link>
            )}
          </div>
        </div>

        {/* Ações principais — visíveis, sem esconder atrás de menus. */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button size="sm" disabled={saving} onClick={handleSaveClick}>
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          {s.contato_id && (
            <Button variant="outline" size="sm" onClick={() => setCreditOpen(true)} title="Usar crédito de cancelamento">
              <Wallet className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Usar crédito</span>
            </Button>
          )}
          <a href={`/voucher-print/${orgSlug}/${s.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" title="Gerar voucher">
              <FileBadge className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Voucher</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" title="Contrato" onClick={() => setContractOpen(true)}>
            <FileSignature className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Contrato</span>
          </Button>
          <ContratoManagerDialog
            orgSlug={orgSlug}
            saleId={s.id}
            clientName={s.client_name}
            open={contractOpen}
            onOpenChange={setContractOpen}
          />
          {s.status !== 'cancelled' && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setCancelOpen(true)} title="Cancelar reserva">
              <Ban className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Cancelar</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir" title="Excluir venda">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dados da Reserva / Produtos / Tarefas / Vouchers / Contratos — abas no topo, cada uma gerida de forma isolada. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dados">Dados da Reserva</TabsTrigger>
          <TabsTrigger value="vouchers"><Upload className="w-3.5 h-3.5 mr-1.5" /> Vouchers</TabsTrigger>
          <TabsTrigger value="tarefas"><ListTodo className="w-3.5 h-3.5 mr-1.5" /> Tarefas</TabsTrigger>
          <TabsTrigger value="produtos"><Package className="w-3.5 h-3.5 mr-1.5" /> Produtos</TabsTrigger>
        </TabsList>

        {/* ── Dados da Reserva ────────────────────────────────── */}
        <TabsContent value="dados" className="space-y-4 pt-4">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lado esquerdo */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Cliente">
                {s.contato_id ? (
                  <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm justify-between gap-2">
                    <span className="truncate">{s.client_name || 'Cliente'}</span>
                    <Link href={`/app/${orgSlug}/contatos/${s.contato_id}`} className="shrink-0 text-primary hover:underline text-xs inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Abrir
                    </Link>
                  </div>
                ) : (
                  <Input value={s.client_name || ''} onChange={e => set('client_name', e.target.value)} />
                )}
              </Field>
              <Field label="Destino"><Input value={s.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Data de ida"><Input type="date" value={s.departure_date || ''} onChange={e => set('departure_date', e.target.value)} /></Field>
              <Field label="Data de volta"><Input type="date" value={s.return_date || ''} onChange={e => set('return_date', e.target.value)} /></Field>
            </div>

            <QuickHospedagensField orgSlug={orgSlug} saleId={s.id} refreshKey={productsRefreshKey} onChanged={() => setProductsRefreshKey(k => k + 1)} />

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
                        FOCUS_RING,
                        active
                          ? 'bg-success/15 text-success border-success/30'
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

            {services.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {services.map(k => <Badge key={k} variant="secondary">{SERVICE_LABELS[k] || k}</Badge>)}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Operadora">
                <OperatorInput value={s.operator || ''} onChange={v => set('operator', v)} options={operatorOptions} />
              </Field>
              <Field label="Localizador"><Input value={s.package_locator || ''} onChange={e => set('package_locator', e.target.value)} placeholder="Ex.: PKG-12345" /></Field>
              <Field label="Forma de pagamento">
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {PAYMENT_METHODS.map(m => {
                    const selectedMethods = (s.payment_method || '').split(',').map((x: string) => x.trim()).filter(Boolean)
                    const active = selectedMethods.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          const next = active ? selectedMethods.filter((x: string) => x !== m) : [...selectedMethods, m]
                          set('payment_method', next.length ? next.join(', ') : null)
                        }}
                        className={cn(
                          'px-2 h-8 rounded-lg border text-[11px] font-medium transition-colors',
                          FOCUS_RING,
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
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-2">Valores</p>
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Valor total"><MoneyInput value={s.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
                <Field label="Comissão">
                  <MoneyInput
                    value={s.commission_cents || 0}
                    onChange={c => {
                      set('commission_cents', c)
                      if (s.retained_commission_cents != null && s.retained_commission_cents > c) {
                        set('retained_commission_cents', c > 0 ? c : null)
                      }
                    }}
                  />
                </Field>
                <RetainedCommissionField
                  commissionCents={s.commission_cents || 0}
                  retainedCents={s.retained_commission_cents}
                  onChange={v => set('retained_commission_cents', v)}
                />
              </div>
            </div>
          </div>

          {/* Lado direito */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5 lg:min-h-[280px]">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Outros viajantes indo junto</p>
            </div>
            <div className="space-y-2">
              {travelers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border bg-background/40 p-2">
                  <div className="flex-1 min-w-[180px] space-y-1 relative">
                    <Label className="text-[11px] text-muted-foreground">Nome completo</Label>
                    <TravelerNameAutocomplete
                      leads={leads}
                      value={t.name || ''}
                      onChangeText={v => { const n = [...travelers]; n[i] = { ...n[i], name: v }; set('travelers', n) }}
                      onPickLead={async (leadId) => {
                        const res = await getContatoTravelerInfo(orgSlug, leadId)
                        if (!res.ok) { toast.error(res.error); return }
                        const n = [...travelers]; n[i] = res.data; set('travelers', n)
                      }}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Nascimento</Label>
                    <Input type="date" value={t.birth_date || ''}
                      onChange={e => { const n = [...travelers]; n[i] = { ...n[i], birth_date: e.target.value }; set('travelers', n) }} />
                  </div>
                  <div className="w-32 space-y-1">
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
        </div>

        <div className="grid gap-2.5 lg:grid-cols-2">
          <Field label="Observações"><Textarea rows={2} value={s.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
          <Field label="Informações importantes">
            <Textarea rows={2} value={s.important_info || ''} onChange={e => set('important_info', e.target.value)}
              placeholder="Contatos de emergência, como buscar atendimento etc." />
          </Field>
          <Field label="Política de cancelamento">
            <Textarea rows={2} value={s.cancellation_policy || ''} onChange={e => set('cancellation_policy', e.target.value)}
              placeholder="Aparece no voucher/contrato só se preenchido." />
          </Field>
          <Field label="Informações de serviço">
            <Textarea rows={2} value={s.service_info || ''} onChange={e => set('service_info', e.target.value)}
              placeholder="O que está incluso, horários, condições de uso etc." />
          </Field>
        </div>

        {s.tasks_generated_at && (
          <p className="text-xs text-success flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Tarefas operacionais já geradas para esta venda.
          </p>
        )}
        </TabsContent>

        {/* ── Produtos ────────────────────────────────────────── */}
        <TabsContent value="produtos" className="pt-4">
          <SaleProductsTab orgSlug={orgSlug} saleId={s.id} refreshKey={productsRefreshKey} />
        </TabsContent>

        {/* ── Tarefas ─────────────────────────────────────────── */}
        <TabsContent value="tarefas" className="pt-4">
          <SaleTasksList orgSlug={orgSlug} saleId={s.id} clientId={s.contato_id} clientName={s.client_name} />
        </TabsContent>

        {/* ── Vouchers ────────────────────────────────────────── */}
        <TabsContent value="vouchers" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <VoucherUploadAndReview
                orgSlug={orgSlug}
                onVoucherAdded={v => {
                  setS(prev => {
                    const next = [...(Array.isArray(prev.vouchers) ? prev.vouchers : []), v]
                    // Persiste na hora — não depende do botão "Salvar" pra o
                    // voucher recém-enviado sobreviver a um refresh/troca de aba.
                    updateTravelSale(orgSlug, prev.id, { vouchers: next })
                    return { ...prev, vouchers: next }
                  })
                }}
              />
            </div>
            <div className="lg:col-span-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vouchers / comprovantes</p>
              {vouchers.length > 0 ? (
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
                        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">Importado pelo agente</span>
                        <Button
                          type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0"
                          disabled={extractingUrl === v.url}
                          onClick={() => handleExtractFromUrl(v)}
                        >
                          {extractingUrl === v.url
                            ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                          Extrair dados
                        </Button>
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
              ) : (
                <p className="text-xs text-muted-foreground border rounded-lg p-4 text-center">Nenhum voucher enviado ainda.</p>
              )}
            </div>
          </div>

          <VoucherExtractDialog
            orgSlug={orgSlug}
            saleId={s.id}
            clientName={s.client_name}
            source={extractSource}
            open={extractOpen}
            onOpenChange={setExtractOpen}
            onScalarFieldsExtracted={fields => setS(prev => mergeExtractedFields(prev, fields, extractLabel))}
            onTravelersExtracted={others => {
              setS(prev => {
                const existing: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(prev.travelers) ? prev.travelers : []
                const existingNames = new Set(existing.map(t => (t.name || '').trim().toLowerCase()))
                const toAdd = others.filter(o => !existingNames.has(o.name.trim().toLowerCase()))
                return toAdd.length > 0 ? { ...prev, travelers: [...existing, ...toAdd] } : prev
              })
            }}
            onProductCreated={() => setProductsRefreshKey(k => k + 1)}
          />
        </TabsContent>

      </Tabs>

      <CancelTravelSaleDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        orgSlug={orgSlug}
        saleId={s.id}
        onCancelled={() => { set('status', 'cancelled'); router.refresh() }}
      />

      {s.contato_id && (
        <ApplyCreditDialog
          open={creditOpen}
          onOpenChange={setCreditOpen}
          orgSlug={orgSlug}
          contatoId={s.contato_id}
          saleId={s.id}
          remainingCents={s.total_cents || 0}
          onApplied={() => router.refresh()}
        />
      )}
    </div>
  )
}

/** Operadora — Select com as operadoras cadastradas em Financeiro (Configurações
 *  > Operadoras); "Outra…" abre um campo de texto livre pra quem ainda não
 *  cadastrou lá, sem bloquear o preenchimento da venda. */
function OperatorInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [freeText, setFreeText] = useState(!!value && !options.includes(value))

  if (freeText || options.length === 0) {
    return (
      <div className="flex gap-1.5">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Ex.: CVC, Azul Viagens…" />
        {options.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setFreeText(false)}>Lista</Button>
        )}
      </div>
    )
  }

  return (
    <Select value={value || undefined} onValueChange={v => v === '__other__' ? setFreeText(true) : onChange(v)}>
      <SelectTrigger><SelectValue placeholder="Selecione a operadora" /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value="__other__">Outra (digitar)…</SelectItem>
      </SelectContent>
    </Select>
  )
}

/** Lista rápida de hospedagens (só o nome) sincronizada direto com
 *  sale_products (kind='hospedagem') — detalhes completos (check-in/regime/
 *  etc.) ficam na aba Produtos; aqui é só o atalho pra não obrigar o agente
 *  a trocar de aba pra registrar o nome do hotel. */
function QuickHospedagensField({
  orgSlug, saleId, refreshKey, onChanged,
}: {
  orgSlug: string
  saleId: string
  refreshKey: number
  onChanged: () => void
}) {
  const [hospedagens, setHospedagens] = useState<SaleProduct[] | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    listSaleProducts(orgSlug, saleId).then(all => setHospedagens(all.filter(p => p.kind === 'hospedagem')))
  }, [orgSlug, saleId, refreshKey])

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    const res = await createSaleProduct(orgSlug, saleId, { kind: 'hospedagem', data: { hotel: newName.trim() } })
    setAdding(false)
    if (!res.ok) { toast.error(res.error); return }
    setNewName('')
    onChanged()
  }

  async function handleRemove(id: string) {
    setHospedagens(prev => prev?.filter(h => h.id !== id) ?? null)
    const res = await deleteSaleProduct(orgSlug, id)
    if (!res.ok) { toast.error(res.error); onChanged() }
  }

  return (
    <Field label="Hotel">
      <div className="space-y-1.5">
        {(hospedagens || []).map(h => (
          <div key={h.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
            <Hotel className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm">{h.data?.hotel || '—'}</span>
            <button type="button" onClick={() => handleRemove(h.id)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover hospedagem">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            placeholder="Nome do hotel…"
          />
          <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={adding} onClick={handleAdd}>
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Detalhes completos (check-in, regime, localizador…) na aba Produtos.</p>
      </div>
    </Field>
  )
}

/** Campo de nome do viajante com sugestões de Contatos conforme digita —
 *  clicar numa sugestão auto-preenche nascimento/CPF do cadastro (substitui
 *  o antigo botão separado "Puxar de contatos"). */
function TravelerNameAutocomplete({
  leads, value, onChangeText, onPickLead,
}: {
  leads: LeadOption[]
  value: string
  onChangeText: (v: string) => void
  onPickLead: (leadId: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const q = value.trim().toLowerCase()
  const matches = q.length >= 2 ? leads.filter(l => l.name.toLowerCase().includes(q)).slice(0, 6) : []
  const showSuggestions = focused && matches.length > 0

  return (
    <div className="relative">
      <Input
        placeholder="Nome completo"
        value={value}
        onChange={e => onChangeText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {showSuggestions && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {matches.map(l => (
            <button
              key={l.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onPickLead(l.id); setFocused(false) }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left hover:bg-muted/60"
            >
              <UserCircle2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
