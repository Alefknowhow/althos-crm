'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/ui/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn, formatCurrency } from '@/lib/utils'
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import { createProposal, deleteProposal, duplicateProposal, updateProposal, type ProposalRow } from '@/actions/travel-proposals'
import { generateQuotationLink, convertQuotationToOffer, createSaleFromQuotation } from '@/actions/quotations'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  FileSignature, Plus, MapPin, Users, CalendarRange, Trash2, Pencil,
  ArrowLeft, Copy, ExternalLink, CheckCircle2, Clock, Wallet, Search, UserCircle2,
  CopyPlus, Loader2, FileText, MessageCircle, ShoppingBag, ShoppingCart,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type Member = { user_id: string; name: string; email: string }
type Contato = { id: string; name: string }

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmtTimestamp(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}
function destOf(p: ProposalRow) {
  return (p.destinations || []).map((d: any) => d?.name).filter(Boolean).join(', ')
}

// 8 cores determinísticas por vendedor, indexadas por hash do user_id — o
// mesmo vendedor sempre pega a mesma cor em toda a lista.
const SELLER_LABEL_COLORS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
]

function sellerLabelColor(userId: string | null | undefined): string {
  if (!userId) return 'bg-muted text-muted-foreground'
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return SELLER_LABEL_COLORS[h % SELLER_LABEL_COLORS.length]
}

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
      <div className={cn('flex items-center gap-1.5 mb-4 flex-wrap shrink-0 md:px-[1%]', selected && 'hidden md:flex')}>
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

      <div className="md:px-[1%] grid md:grid-cols-[50fr_48fr] gap-4 flex-1 min-h-0">
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

function DuplicateProposalDialog({
  orgSlug, proposal, contatos, onClose, onDone,
}: {
  orgSlug: string
  proposal: ProposalRow | null
  contatos: Contato[]
  onClose: () => void
  onDone: (newId: string) => void
}) {
  const [q, setQ] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset transient state whenever the dialog opens for a new proposal.
  useEffect(() => {
    if (proposal) { setQ(''); setTargetId(null); setSaving(false) }
  }, [proposal])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? contatos.filter(c => (c.name || '').toLowerCase().includes(needle))
      : contatos
    return list.slice(0, 50)
  }, [contatos, q])

  async function handleConfirm() {
    if (!proposal || !targetId) return
    setSaving(true)
    const res = await duplicateProposal(orgSlug, proposal.id, targetId)
    setSaving(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao duplicar proposta'); return }
    toast.success('Cópia criada para o contato selecionado')
    onDone(res.data.id)
  }

  return (
    <Dialog open={!!proposal} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar proposta para outro lead</DialogTitle>
          <DialogDescription>
            Cria uma nova proposta com todo o conteúdo de
            {' '}<span className="font-medium text-foreground">{proposal?.title || 'proposta'}</span>{' '}
            vinculada ao contato escolhido. A nova cópia começa como rascunho e gera um novo link ao compartilhar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar contato pelo nome…"
              className="pl-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
            ) : filtered.map(c => {
              const active = c.id === targetId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTargetId(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50',
                  )}
                >
                  <span className="truncate">{c.name || 'Sem nome'}</span>
                  {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!targetId || saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Copiando…</>
              : <><CopyPlus className="w-4 h-4 mr-1.5" /> Criar cópia</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Botão de ação quadrado, só ícone — usado na linha da tabela de propostas
 *  pra permitir agir direto na lista, sem precisar abrir o detalhe. */
function RowActionButton({
  icon: Icon, label, onClick, href, newTab = true, disabled, tone,
}: {
  icon: any
  label: string
  onClick?: () => void
  href?: string
  /** false navega na mesma aba (Editar); true abre em nova aba (Abrir/Gerar PDF). */
  newTab?: boolean
  disabled?: boolean
  tone?: 'destructive'
}) {
  const className = cn(
    'inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-md border border-input bg-background transition-colors',
    'hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background',
    tone === 'destructive' && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
  )
  if (href && !disabled) {
    if (!newTab) {
      return (
        <Link href={href} className={className} title={label} aria-label={label}>
          <Icon className="w-3.5 h-3.5" />
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={label} aria-label={label}>
        <Icon className="w-3.5 h-3.5" />
      </a>
    )
  }
  return (
    <button type="button" className={className} title={label} aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

function ProposalRowActions({
  orgSlug, p, onDelete,
}: {
  orgSlug: string
  p: ProposalRow
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  useEffect(() => {
    if (p.public_token) setPublicUrl(`${window.location.origin}/p/${p.public_token}`)
  }, [p.public_token])

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { toast.error('Não foi possível copiar') }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <RowActionButton icon={Pencil} label="Editar" href={`/app/${orgSlug}/cotacoes/${p.id}`} newTab={false} />
      <RowActionButton
        icon={copied ? CheckCircle2 : Copy}
        label={copied ? 'Copiado' : 'Copiar link'}
        onClick={copyLink}
        disabled={!publicUrl}
      />
      <RowActionButton
        icon={ExternalLink}
        label="Abrir"
        href={publicUrl || undefined}
        disabled={!publicUrl}
      />
      <RowActionButton icon={FileText} label="Gerar PDF" href={`/app/${orgSlug}/cotacoes/${p.id}/pdf`} />
      <RowActionButton icon={Trash2} label="Excluir" onClick={onDelete} tone="destructive" />
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

function ProposalDetail({
  orgSlug, p, sellerName, onBack, onDuplicate,
}: {
  orgSlug: string
  p: ProposalRow
  sellerName: string | null
  onBack: () => void
  onDuplicate: () => void
}) {
  const router = useRouter()
  const dest = destOf(p)
  const travelers = Array.isArray(p.travelers) ? p.travelers : []
  const [sending, setSending] = useState(false)
  const [convertingOffer, setConvertingOffer] = useState(false)
  const [generatingSale, setGeneratingSale] = useState(false)

  async function handleSendToClient() {
    setSending(true)
    let token = p.public_token
    if (!token) {
      const res = await generateQuotationLink(orgSlug, p.id, false)
      if (!res.ok) { toast.error(res.error); setSending(false); return }
      token = res.token
    }
    setSending(false)
    const url = `${window.location.origin}/p/${token}`
    const firstName = (p.client_name || '').trim().split(/\s+/)[0]
    const msg = `Oi${firstName ? ` ${firstName}` : ''}! Preparei sua proposta de viagem${p.title ? ` — ${p.title}` : ''}. Dá uma olhada com carinho: ${url}`
    // Sem telefone disponível nesta prévia (ProposalRow não traz o contato
    // completo) — abre o WhatsApp sem destinatário, escolhido na hora.
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    toast.info('Escolha o destinatário no WhatsApp.')
  }

  async function handleAddToOffers() {
    setConvertingOffer(true)
    const res = await convertQuotationToOffer(orgSlug, p.id)
    setConvertingOffer(false)
    if (res.ok) { toast.success('Cotação copiada para uma nova oferta'); router.push(`/app/${orgSlug}/ofertas/${res.id}`) }
    else toast.error(res.error)
  }

  async function handleGenerateReserva() {
    setGeneratingSale(true)
    const res = await createSaleFromQuotation(orgSlug, p.id)
    setGeneratingSale(false)
    if (res.ok) {
      toast.success(res.existed ? 'Esta cotação já tinha uma reserva — abrindo…' : 'Reserva criada com os dados da cotação')
      router.push(`/app/${orgSlug}/reservas?sale=${res.saleId}`)
    } else toast.error(res.error)
  }

  return (
    <div className="flex flex-col w-full">
      {/* header */}
      <div className="sticky top-0 bg-card/90   border-b p-4 flex flex-col gap-2 sm:flex-row sm:items-center z-10">
        {/* Título — pequeno, negrito e discreto no mobile; normal no desktop */}
        <h2 className="order-1 min-w-0 sm:flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground sm:text-base sm:font-semibold sm:normal-case sm:tracking-normal sm:text-foreground">
          {p.title || 'Proposta sem título'}
        </h2>
        <div className="order-2 flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto">
          <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={onDuplicate}
            title="Copiar proposta para outro lead/contato"
            aria-label="Copiar proposta para outro lead/contato"
          >
            <CopyPlus className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Duplicar</span>
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={handleSendToClient} disabled={sending}
            title="Enviar ao cliente" aria-label="Enviar ao cliente"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Enviar ao cliente</span>
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={handleAddToOffers} disabled={convertingOffer}
            title="Adicionar a ofertas" aria-label="Adicionar a ofertas"
          >
            {convertingOffer ? <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Adicionar a ofertas</span>
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={handleGenerateReserva} disabled={generatingSale}
            title="Gerar reserva" aria-label="Gerar reserva"
          >
            {generatingSale ? <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Gerar reserva</span>
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {Array.isArray(p.photos) && p.photos.length > 0 && p.photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photos[0]}
            alt="Foto de capa"
            className="w-full max-h-56 object-cover rounded-lg border"
          />
        )}
        <div className="text-2xl font-bold tabular-nums">{formatCurrency(p.total_cents || 0)}</div>

        <div className="grid sm:grid-cols-2 gap-4">
          <DetailRow icon={Users} label="Cliente" value={p.client_name || '—'} />
          <DetailRow icon={MapPin} label="Destino" value={dest || '—'} />
          <DetailRow icon={CalendarRange} label="Período" value={`${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`} />
          <DetailRow icon={Users} label="Nº de pessoas" value={p.pax_count ?? '—'} />
          <DetailRow icon={Wallet} label="Valor por pessoa" value={p.price_per_person_cents ? formatCurrency(p.price_per_person_cents) : '—'} />
          <DetailRow icon={Clock} label="Criada em" value={fmtTimestamp(p.created_at)} />
          {sellerName && <DetailRow icon={UserCircle2} label="Vendedor" value={sellerName} />}
        </div>

        <p className="text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
          Cotação realizada em {fmtTimestamp(p.created_at)}. Preços e tarifas estão sujeitos a alterações sem aviso prévio.
        </p>

        {travelers.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Viajantes</p>
            <div className="flex flex-wrap gap-1.5">
              {travelers.map((t: any, i: number) => (
                <Badge key={i} variant="secondary">{t.name || 'Sem nome'}{t.age ? ` · ${t.age}` : ''}</Badge>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
