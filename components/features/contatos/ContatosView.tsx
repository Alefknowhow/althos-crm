'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { getOrCreateConversationForLead } from '@/actions/whatsapp'
import { WhatsAppGlyph } from '@/components/features/LeadCard'
import { cn, formatPhoneDisplay } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, SlidersHorizontal, Plus, Loader2, ChevronLeft, ExternalLink, Phone,
  FileCheck2, Users, Wallet, CalendarClock, Camera, Trash2,
  Bookmark, X, MessageCircle, FileSignature, Plane, RefreshCw, UserCircle2, Sparkles, History,
  CheckSquare, Mail, Tag as TagIcon, Coins,
} from 'lucide-react'
import {
  CONTATO_STATUSES, CONTATO_STATUS_META, contatoSourceLabel, type ContatoStatus,
} from '@/lib/contatos'
import {
  createContato, setContatoStatus, uploadContatoAvatar, removeContatoAvatar,
  getContatoTravelLinks, reopenNegotiation, listContatoDeals, updateLeadTags, deleteLead,
  type ContatoQuoteLink, type ContatoReservationLink, type ContatoDeal, type ContatoContactPoint,
} from '@/actions/contatos'
import { listCreditsForContato, type TravelCreditRow } from '@/actions/travel-credits'
import { createSavedFilter, deleteSavedFilter, type SavedFilter } from '@/actions/saved_filters'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import ContatoRelationships from '@/components/features/contatos/ContatoRelationships'
import PropertyInterestsSection from '@/components/features/properties/PropertyInterestsSection'
import PropertyVisitsSection from '@/components/features/properties/PropertyVisitsSection'
import PropertyPreferencesCard from '@/components/features/properties/PropertyPreferencesCard'
import PropertyMatchSuggestions from '@/components/features/properties/PropertyMatchSuggestions'
import CopyButton from '@/components/ui/copy-button'
import AIScoreBadge from '@/components/features/ai/AIScoreBadge'
import RequalifyButton from '@/components/features/ai/RequalifyButton'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import SendCustomEmailDialog from '@/components/features/SendCustomEmailDialog'
import TaskCard from '@/components/features/TaskCard'
import TaskDialog from '@/components/features/TaskDialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PhoneCall, MoreVertical, Pencil, ListChecks } from 'lucide-react'

// ── Tipos vindos da página (server) ──────────────────────────────────
type ListRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string | null
  source: string | null
  avatar_url: string | null
  city: string | null
  state: string | null
  tags: string[] | null
  value_cents: number | null
  became_customer_at: string | null
  last_activity_at: string | null
  created_at: string | null
  updated_at: string | null
  ai_tier: string | null
  has_documents: boolean
}

type Sale = {
  id: string
  sale_date: string | null
  amount_cents: number | null
  status: string | null
  payment_method: string | null
  installments: number | null
  products: { name: string } | null
}

type Selected = {
  contato: any
  documents: any[]
  sales: Sale[]
  relationships: any[]
  propertyInterests?: any[]
  propertyVisits?: any[]
  propertyPreferences?: any
  contactPoints: ContatoContactPoint[]
  activities: any[]
  tasks: any[]
  emailSends: any[]
  templates: any[]
  whatsappConv: any | null
  travelReservas?: any[]
  travelCotacoes?: any[]
} | null

type Filters = Record<string, string | undefined>

interface Props {
  orgSlug: string
  contatos: ListRow[]
  selected: Selected
  selectedId: string
  total: number
  page: number
  pageSize: number
  pipelines: { id: string; name: string; is_default: boolean }[]
  allTags: string[]
  allSources: string[]
  savedFilters: SavedFilter[]
  filters: Filters
  isTravel: boolean
  isRealEstate?: boolean
  properties?: { id: string; title: string; code: string | null }[]
  members: { id: string; name: string }[]
  statusTabs?: React.ReactNode
  orgName: string
}

// ── Helpers ──────────────────────────────────────────────────────────
function fmtCurrency(cents: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}
function fmtDate(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}
function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name || '?').slice(0, 2).toUpperCase()
}
function relativeTime(d: string | null | undefined): string {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `há ${months}m`
  return `há ${Math.floor(months / 12)}a`
}
function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

const STATUS_VALUES = CONTATO_STATUSES

export default function ContatosView({
  orgSlug,
  contatos,
  selected,
  selectedId,
  total,
  page,
  pageSize,
  pipelines,
  allTags,
  allSources,
  savedFilters,
  filters,
  isTravel,
  isRealEstate,
  properties = [],
  members,
  statusTabs,
  orgName,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileDetail, setMobileDetail] = useState(false)
  // Linked-records popup (cotações / reservas) for a given contato.
  const [linksFor, setLinksFor] = useState<{ kind: 'quotes' | 'reservations'; contato: ListRow } | null>(null)

  // ── Navegação por URL preservando params ──────────────────────────
  function buildUrl(patch: Record<string, string | null>): string {
    const sp = new URLSearchParams(searchParams?.toString() || '')
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    const qs = sp.toString()
    return `${pathname}${qs ? `?${qs}` : ''}`
  }
  function navigate(patch: Record<string, string | null>) {
    router.push(buildUrl(patch))
  }

  function selectRow(id: string) {
    setMobileDetail(true)
    navigate({ sel: id })
  }

  // Botão "Conversas" da lista: acha a conversa já existente com esse
  // contato (no número WABA cadastrado) ou cria uma nova sem enviar
  // mensagem — mesmo padrão do botão "Iniciar Waba" do Pipeline
  // (actions/whatsapp.ts::getOrCreateConversationForLead) — e leva
  // direto pro chat já pronto pra digitar, em vez de só filtrar a lista
  // de conversas por lead (que ficava vazio quando não existia thread ainda).
  const [conversationLoadingId, setConversationLoadingId] = useState<string | null>(null)
  async function handleOpenConversation(contatoId: string) {
    if (conversationLoadingId) return
    setConversationLoadingId(contatoId)
    const res = await getOrCreateConversationForLead(orgSlug, contatoId)
    setConversationLoadingId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.push(`/app/${orgSlug}/conversas?id=${res.conversationId}`)
  }

  // ── Busca com debounce → URL ──────────────────────────────────────
  const [searchInput, setSearchInput] = useState(filters.q || '')
  useEffect(() => {
    setSearchInput(filters.q || '')
  }, [filters.q])
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = filters.q || ''
      if (searchInput === current) return
      router.push(buildUrl({ q: searchInput || null, page: null, sel: null }))
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // ── Paginação ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = page + 1
  const rangeStart = total === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min(total, (page + 1) * pageSize)

  const activeFilterCount = countActiveFilters(filters)

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className={cn('flex flex-wrap items-center gap-2 shrink-0', mobileDetail && 'hidden md:flex')}>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, e-mail ou telefone..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {statusTabs}

        <FiltersSheet
          filters={filters}
          allTags={allTags}
          allSources={allSources}
          pipelines={pipelines}
          activeCount={activeFilterCount}
          onApply={patch => router.push(buildUrl({ ...patch, page: null, sel: null }))}
          onClear={() => router.push(pathname)}
        />

        <NewContatoDialog
          orgSlug={orgSlug}
          onCreated={id => selectRow(id)}
        />

        <div className="flex-1" />
      </div>

      {/* ── Master-detail ───────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 md:min-h-[480px]">
        {/* Master */}
        <div
          className={cn(
            'md:w-[300px] lg:w-[360px] md:shrink-0 rounded-none border bg-card flex flex-col overflow-hidden',
            mobileDetail && 'hidden md:flex',
          )}
        >
          <div className="flex-1 overflow-y-auto divide-y">
            {contatos.map(c => {
              const active = c.id === selectedId
              const meta = CONTATO_STATUS_META[(c.status as ContatoStatus)] || null
              return (
                <div
                  key={c.id}
                  className={cn(
                    'px-3 py-2.5 transition-colors',
                    active ? 'bg-primary/10' : 'hover:bg-muted/40',
                  )}
                >
                  <button
                    onClick={() => selectRow(c.id)}
                    className="w-full text-left flex items-center gap-3"
                  >
                    <ListAvatar name={c.name} url={c.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        {c.has_documents && (
                          <FileCheck2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" />
                        {c.phone ? formatPhoneDisplay(c.phone) : 'Sem telefone'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {meta && (
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.badgeClass)}>
                          {meta.label}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(c.last_activity_at || c.updated_at)}
                      </span>
                    </div>
                  </button>

                  {/* Atalhos: conversas, cotações enviadas, reservas */}
                  <div className="mt-2 flex items-center gap-1.5 pl-12">
                    <ShortcutButton
                      label="Conversas"
                      icon={MessageCircle}
                      onClick={() => handleOpenConversation(c.id)}
                    />
                    {isTravel && (
                      <>
                        <ShortcutButton
                          label="Cotações enviadas"
                          icon={FileSignature}
                          onClick={() => setLinksFor({ kind: 'quotes', contato: c })}
                        />
                        <ShortcutButton
                          label="Reservas"
                          icon={Plane}
                          onClick={() => setLinksFor({ kind: 'reservations', contato: c })}
                        />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {contatos.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                Nenhum contato corresponde aos filtros.
              </div>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{rangeStart}–{rangeEnd} de {total}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="outline" className="h-7 px-2"
                  disabled={currentPage <= 1}
                  onClick={() => navigate({ page: String(currentPage - 1), sel: null })}
                >
                  Anterior
                </Button>
                <span className="px-1 tabular-nums">{currentPage}/{totalPages}</span>
                <Button
                  size="sm" variant="outline" className="h-7 px-2"
                  disabled={currentPage >= totalPages}
                  onClick={() => navigate({ page: String(currentPage + 1), sel: null })}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        <div
          className={cn(
            'md:flex-1 md:min-w-0 rounded-none border bg-card overflow-y-auto',
            !mobileDetail && 'hidden md:block',
          )}
        >
          {selected ? (
            <DetailPanel
              key={selected.contato.id}
              orgSlug={orgSlug}
              selected={selected}
              onBack={() => setMobileDetail(false)}
              members={members}
              isTravel={isTravel}
              isRealEstate={isRealEstate}
              properties={properties}
              orgName={orgName}
            />
          ) : (
            <div className="h-full grid place-items-center p-10 text-center">
              <div className="space-y-2 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-sm">Selecione um contato para ver os detalhes.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popup: registros ligados (cotações / reservas) */}
      <LinkedRecordsDialog
        orgSlug={orgSlug}
        target={linksFor}
        onClose={() => setLinksFor(null)}
      />
    </div>
  )
}

// ── Botão de atalho (pill) ───────────────────────────────────────────
function ShortcutButton({
  label, icon: Icon, onClick, asChild, children,
}: {
  label: string
  icon: any
  onClick?: () => void
  asChild?: boolean
  /** Only used when asChild — should be the navigation element (e.g. a <Link>). */
  children?: React.ReactNode
}) {
  // Plain clickable icon: no label, no border, no background.
  const cls =
    'inline-flex items-center justify-center p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-md'
  if (asChild) {
    // The child is the link wrapper; render only the icon inside it.
    return (
      <span className={cls} title={label} aria-label={label}>
        {children}
      </span>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} title={label} aria-label={label}>
      <Icon className="w-4 h-4" />
    </button>
  )
}

// ── Popup de registros ligados ───────────────────────────────────────
function LinkedRecordsDialog({
  orgSlug, target, onClose,
}: {
  orgSlug: string
  target: { kind: 'quotes' | 'reservations'; contato: ListRow } | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [quotes, setQuotes] = useState<ContatoQuoteLink[]>([])
  const [reservations, setReservations] = useState<ContatoReservationLink[]>([])

  useEffect(() => {
    if (!target) return
    let cancelled = false
    setLoading(true)
    getContatoTravelLinks(orgSlug, target.contato.id)
      .then(res => {
        if (cancelled) return
        setQuotes(res.quotes)
        setReservations(res.reservations)
      })
      .catch(() => {
        if (!cancelled) toast.error('Não foi possível carregar os registros.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [target, orgSlug])

  const isQuotes = target?.kind === 'quotes'
  const title = isQuotes ? 'Cotações enviadas' : 'Reservas'

  return (
    <Dialog open={!!target} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {isQuotes ? <FileSignature className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
              {title}
            </h2>
            {target && (
              <p className="text-sm text-muted-foreground">{target.contato.name}</p>
            )}
          </div>

          {loading ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isQuotes ? (
            quotes.length === 0 ? (
              <EmptyLinked label="Nenhuma cotação enviada para este contato." />
            ) : (
              <div className="divide-y rounded-lg border max-h-[60vh] overflow-y-auto">
                {quotes.map(q => (
                  <Link
                    key={q.id}
                    href={`/app/${orgSlug}/cotacoes/${q.id}`}
                    onClick={onClose}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{q.title || 'Cotação'}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(q.created_at)} · {q.status || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold tabular-nums">{fmtCurrency(q.total_cents)}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : reservations.length === 0 ? (
            <EmptyLinked label="Nenhuma reserva para este contato." />
          ) : (
            <div className="divide-y rounded-lg border max-h-[60vh] overflow-y-auto">
              {reservations.map(r => (
                <Link
                  key={r.id}
                  href={`/app/${orgSlug}/reservas`}
                  onClick={onClose}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.destination || 'Reserva'}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.departure_date ? `Embarque ${fmtDate(r.departure_date)}` : fmtDate(r.created_at)} · {r.status || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums">{fmtCurrency(r.total_cents)}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmptyLinked({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>
  )
}

// ── Avatar na lista ──────────────────────────────────────────────────
function ListAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="shrink-0 w-9 h-9 rounded-full object-cover" />
  }
  return (
    <span className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-brand-100 text-brand-700 text-xs font-semibold">
      {initials(name)}
    </span>
  )
}

// ── Painel de detalhe ────────────────────────────────────────────────
function DetailPanel({
  orgSlug, selected, onBack, members, isTravel, isRealEstate, properties = [], orgName,
}: {
  orgSlug: string
  selected: NonNullable<Selected>
  onBack: () => void
  members: { id: string; name: string }[]
  isTravel: boolean
  isRealEstate?: boolean
  properties?: { id: string; title: string; code: string | null }[]
  orgName: string
}) {
  const router = useRouter()
  const c = selected.contato
  const stageName = c.pipeline_stages?.name as string | undefined
  const sellerName = c.assigned_to ? members.find(m => m.id === c.assigned_to)?.name : null
  const [savingStatus, startStatus] = useTransition()
  const [reopening, startReopen] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [deals, setDeals] = useState<ContatoDeal[]>([])
  const [credits, setCredits] = useState<TravelCreditRow[]>([])
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('visao-geral')
  const [dadosEditRequested, setDadosEditRequested] = useState(false)
  const [openingConversation, setOpeningConversation] = useState(false)

  async function handleOpenConversation(contatoId: string) {
    if (openingConversation) return
    setOpeningConversation(true)
    const res = await getOrCreateConversationForLead(orgSlug, contatoId)
    setOpeningConversation(false)
    if (!res.ok) { toast.error(res.error); return }
    router.push(`/app/${orgSlug}/conversas?id=${res.conversationId}`)
  }

  const completedSales = selected.sales.filter(s => s.status === 'completed')
  const totalPurchased = completedSales.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const lastPurchase = completedSales[0]?.sale_date || null

  useEffect(() => {
    let active = true
    if (c.status === 'cliente') {
      listContatoDeals(orgSlug, c.id).then(d => { if (active) setDeals(d) })
    } else {
      setDeals([])
    }
    return () => { active = false }
  }, [orgSlug, c.id, c.status])

  useEffect(() => {
    let active = true
    if (isTravel) {
      listCreditsForContato(orgSlug, c.id).then(cr => { if (active) setCredits(cr) })
    } else {
      setCredits([])
    }
    return () => { active = false }
  }, [orgSlug, c.id, isTravel])

  const creditBalance = credits.reduce((a, cr) => a + (cr.status === 'available' ? cr.valor_cents - cr.valor_usado_cents : 0), 0)

  function changeStatus(value: string) {
    startStatus(async () => {
      const res = await setContatoStatus(orgSlug, c.id, value)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Classificação atualizada.')
      router.refresh()
    })
  }

  function handleDelete() {
    if (!window.confirm('Excluir este contato? Essa ação não pode ser desfeita — o contato e todas as suas atividades serão perdidos.')) return
    startDelete(async () => {
      const res = await deleteLead(orgSlug, c.id)
      if (!res.ok) { toast.error(res.error || 'Erro ao excluir contato'); return }
      toast.success('Contato excluído.')
      router.push(`/app/${orgSlug}/contatos`)
    })
  }

  function handleReopen() {
    if (!window.confirm('Arquivar a negociação atual e voltar esse cliente pro início do funil?')) return
    startReopen(async () => {
      const res = await reopenNegotiation(orgSlug, c.id)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Nova negociação iniciada.')
      router.refresh()
    })
  }

  const [tags, setTags] = useState<string[]>(Array.isArray(c.tags) ? c.tags : [])
  const [tagInput, setTagInput] = useState('')
  async function saveTags(next: string[]) {
    setTags(next)
    const res = await updateLeadTags(orgSlug, c.id, next)
    if (!res.ok) toast.error(res.error)
  }
  function addTag() {
    const v = tagInput.trim()
    if (!v || tags.includes(v)) { setTagInput(''); return }
    setTagInput('')
    saveTags([...tags, v])
  }
  function removeTag(t: string) {
    saveTags(tags.filter(x => x !== t))
  }


  return (
    <div className="p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="md:hidden mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <AvatarUploader orgSlug={orgSlug} contatoId={c.id} name={c.name} url={c.avatar_url} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold leading-tight break-words">{c.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c.phone && <span>{formatPhoneDisplay(c.phone)}</span>}
            {c.email && <span>{c.phone ? ' · ' : ''}{c.email}</span>}
            {(c.phone || c.email) && ' · '}
            Origem: {contatoSourceLabel(c.source)}
            {stageName ? ` · Funil: ${stageName}` : ''}
          </p>
          <div className="mt-2 w-44">
            <Select value={(c.status as string) || 'lead'} onValueChange={changeStatus} disabled={savingStatus}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map(s => (
                  <SelectItem key={s} value={s}>{CONTATO_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tags — bloco de linha única destacado, sempre visível no topo */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-primary/[0.04] border-primary/20 px-3 py-2">
        <TagIcon className="w-3.5 h-3.5 text-primary shrink-0" />
        {tags.map(t => (
          <Badge key={t} variant="secondary" className="text-[11px] gap-1 pr-1">
            {t}
            <button type="button" onClick={() => removeTag(t)} aria-label={`Remover tag ${t}`} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          onBlur={addTag}
          placeholder="+ tag"
          className="h-6 w-20 text-[11px] px-2 bg-background"
        />
      </div>

      {/* Cards de resumo — compactos, logo abaixo das tags */}
      <div className={cn('grid grid-cols-2 gap-2', isTravel ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <Field icon={Wallet} label="Total comprado" dense>
          <span className="text-base font-bold text-primary">{fmtCurrency(totalPurchased)}</span>
        </Field>
        <Field icon={CalendarClock} label="Última compra" dense>
          <span className="text-base font-bold">{fmtDate(lastPurchase)}</span>
        </Field>
        <Field icon={UserCircle2} label="Vendedor responsável" dense>
          <span className="text-xs font-medium">{sellerName || '—'}</span>
        </Field>
        <Field icon={Sparkles} label="Score IA" dense>
          {c.ai_score != null && c.ai_tier != null ? (
            <AIScoreBadge score={c.ai_score} tier={c.ai_tier} summary={c.ai_summary} size="sm" />
          ) : (
            <span className="text-xs font-medium">—</span>
          )}
        </Field>
        {isTravel && (
          <Field icon={Coins} label="Créditos de cancelamento" dense>
            <span className="text-base font-bold text-primary">{creditBalance > 0 ? fmtCurrency(creditBalance) : '—'}</span>
          </Field>
        )}
      </div>

      {/* Barra de ações principais */}
      <div className="flex flex-wrap gap-2">
        {c.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`https://wa.me/${onlyDigits(c.phone)}`} target="_blank" rel="noopener noreferrer">
              <WhatsAppGlyph color="#25D366" /> <span className="ml-1.5">WhatsApp</span>
            </a>
          </Button>
        )}
        {c.phone && (
          <Button
            size="sm"
            variant="outline"
            disabled={openingConversation}
            onClick={() => handleOpenConversation(c.id)}
          >
            <WhatsAppGlyph color="#0a84ff" /> <span className="ml-1.5">Iniciar Waba</span>
          </Button>
        )}
        {c.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${onlyDigits(c.phone)}`}>
              <PhoneCall className="w-4 h-4 mr-1.5" /> Ligar
            </a>
          </Button>
        )}
        {c.email && (
          <SendEmailDialog orgSlug={orgSlug} lead={c} templates={selected.templates} org={{ name: orgName }} />
        )}
        <Button size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Atividade
        </Button>
        {c.status === 'cliente' && (
          <Button size="sm" variant="outline" onClick={handleReopen} disabled={reopening}>
            <RefreshCw className={cn('w-4 h-4 mr-1.5', reopening && 'animate-spin')} /> Nova negociação
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="px-2">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <RequalifyButton orgSlug={orgSlug} leadId={c.id} asMenuItem />
            <DropdownMenuItem onClick={() => setDadosEditRequested(true)}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Editar dados
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir contato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="negociacoes">Negociações</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        {/* ── Visão geral ─────────────────────────────────────────── */}
        <TabsContent value="visao-geral" className="space-y-5 pt-4">
          {/* Cadastro do Cliente — incorporado à Visão geral, no topo da aba */}
          <CustomerProfileForm
            orgSlug={orgSlug}
            leadId={c.id}
            initial={c}
            initialContactPoints={selected.contactPoints}
            initialDocuments={selected.documents}
            initialEditMode={dadosEditRequested}
          />

          {/* Parentesco */}
          <ContatoRelationships orgSlug={orgSlug} contatoId={c.id} initial={selected.relationships} />

          {/* Negociações (resumo) */}
          {deals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Negociações
                </p>
                {deals.length > 2 && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setActiveTab('negociacoes')}>
                    ver todas
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {deals.slice(0, 2).map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />)}
              </div>
            </div>
          )}

          {/* Créditos de Cancelamento (Viagens) — resumo já vira card na linha
              de topo; aqui só o detalhamento por crédito, quando existir. */}
          {isTravel && credits.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Detalhamento dos créditos
              </p>
              <div className="space-y-1.5">
                {credits.map(cr => {
                    const saldo = cr.valor_cents - cr.valor_usado_cents
                    const statusLabel = cr.status === 'used' ? 'Utilizado' : cr.status === 'cancelled' ? 'Cancelado' : cr.validade && new Date(cr.validade) < new Date() ? 'Expirado' : 'Disponível'
                    return (
                      <div key={cr.id} className="border rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{cr.operadora}</span>
                          <span className="font-semibold tabular-nums">{fmtCurrency(saldo)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{fmtDate(cr.data_emissao)}</span>
                          {cr.validade && <span>· Válido até {fmtDate(cr.validade)}</span>}
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{statusLabel}</Badge>
                          {cr.origem_sale_id && (
                            <Link href={`/app/${orgSlug}/reservas?sale=${cr.origem_sale_id}`} className="text-primary hover:underline">
                              Ver venda de origem
                            </Link>
                          )}
                        </div>
                        {cr.observacoes && <div className="text-xs text-muted-foreground mt-1">{cr.observacoes}</div>}
                      </div>
                    )
                  })}
                </div>
            </div>
          )}

          {/* Imóveis de interesse / Visitas — só nicho imobiliário */}
          {isRealEstate && (
            <>
              <PropertyInterestsSection orgSlug={orgSlug} mode={{ type: 'contato', contatoId: c.id }} initial={selected.propertyInterests || []} properties={properties} />
              <PropertyVisitsSection orgSlug={orgSlug} mode={{ type: 'contato', contatoId: c.id }} initial={selected.propertyVisits || []} properties={properties} members={members.map(m => ({ user_id: m.id, name: m.name }))} />
              <PropertyPreferencesCard orgSlug={orgSlug} contatoId={c.id} initial={selected.propertyPreferences || null} />
              <PropertyMatchSuggestions orgSlug={orgSlug} contatoId={c.id} />
            </>
          )}
        </TabsContent>

        {/* ── Atividades ──────────────────────────────────────────── */}
        <TabsContent value="atividades" className="space-y-5 pt-4">
          {/* Tarefas / E-mails / WhatsApp lado a lado — cada bloco é uma
              frente de trabalho independente; Timeline abaixo cruza as 3. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tarefas</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
                </Button>
              </div>
              <div className="space-y-3">
                {selected.tasks.length > 0 ? selected.tasks.map((task: any) => (
                  <TaskCard key={task.id} task={task} orgSlug={orgSlug} />
                )) : (
                  <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma tarefa vinculada.</p>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">E-mails</p>
                {c.email && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SendEmailDialog
                      orgSlug={orgSlug}
                      lead={c}
                      templates={selected.templates}
                      org={{ name: orgName }}
                      trigger={<Button type="button" size="sm" variant="outline">Disparar template</Button>}
                    />
                    <SendCustomEmailDialog
                      orgSlug={orgSlug}
                      lead={c}
                      trigger={<Button type="button" size="sm" variant="outline">Enviar e-mail</Button>}
                    />
                  </div>
                )}
              </div>
              {selected.emailSends.length > 0 ? (
                <div className="space-y-2 border rounded-lg divide-y">
                  {selected.emailSends.map((es: any) => (
                    <div key={es.id} className="flex justify-between items-center px-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">{(Array.isArray(es.email_templates) ? es.email_templates[0]?.name : es.email_templates?.name) || 'E-mail avulso'}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(es.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <Badge variant={es.status === 'sent' ? 'default' : es.status === 'opened' ? 'secondary' : es.status === 'failed' || es.status === 'bounced' ? 'destructive' : 'outline'}>{es.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhum e-mail enviado.</p>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">WhatsApp</p>
              {selected.whatsappConv ? (
                <div className="text-sm border rounded-lg p-3 bg-muted/20 flex flex-col items-center justify-center text-center gap-1.5">
                  <div className="font-semibold">{selected.whatsappConv.contact_name || selected.whatsappConv.contact_phone}</div>
                  <div className="text-muted-foreground text-xs">{selected.whatsappConv.contact_phone}</div>
                  <div className="text-[11px] mt-1 bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Última interação: {fmtDate(selected.whatsappConv.last_message_at)}
                  </div>
                  <Link href={`/app/${orgSlug}/conversas?id=${selected.whatsappConv.id}`} className="flex w-full">
                    <Button className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white">Abrir Conversa WhatsApp</Button>
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Sem conversa vinculada.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Timeline</p>
            {selected.activities.length > 0 ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {selected.activities.map((act: any) => <ActivityRow key={act.id} act={act} fmtCurrency={fmtCurrency} />)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma atividade registrada.</p>
            )}
          </div>
        </TabsContent>

        {/* ── Negociações ─────────────────────────────────────────── */}
        {/* Nicho viagens: cotações (travel_proposals) ligadas ao lead, não o
            histórico genérico de negocios (que é sobre movimento de pipeline,
            não sobre o que foi efetivamente proposto ao cliente). */}
        <TabsContent value="negociacoes" className="pt-4">
          {isTravel ? (
            (selected.travelCotacoes || []).length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Cotação</th>
                      <th className="text-left font-medium px-3 py-2">Período</th>
                      <th className="text-right font-medium px-3 py-2">Valor</th>
                      <th className="text-left font-medium px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selected.travelCotacoes || []).map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/app/${orgSlug}/cotacoes/${p.id}`} className="hover:underline">
                            {p.title || 'Cotação'}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.start_date ? `${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(p.total_cents || 0)}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{p.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma cotação registrada.</p>
            )
          ) : deals.length > 0 ? (
            <div className="space-y-2">
              {deals.map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />)}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma negociação registrada.</p>
          )}
        </TabsContent>

        {/* ── Compras ─────────────────────────────────────────────── */}
        {/* Nicho viagens: reservas (travel_sales), não a tabela genérica
            `sales` (que é de outros nichos e fica sempre vazia aqui). */}
        <TabsContent value="compras" className="pt-4">
          {isTravel ? (
            (selected.travelReservas || []).length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Data</th>
                      <th className="text-left font-medium px-3 py-2">Destino</th>
                      <th className="text-right font-medium px-3 py-2">Valor</th>
                      <th className="text-left font-medium px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selected.travelReservas || []).map((s: any) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.created_at)}</td>
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/app/${orgSlug}/reservas?sale=${s.id}`} className="hover:underline">
                            {s.destination || s.package_locator || s.sale_number || 'Reserva'}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(s.total_cents || 0)}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma reserva registrada.</p>
            )
          ) : selected.sales.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Data</th>
                    <th className="text-left font-medium px-3 py-2">Produto</th>
                    <th className="text-right font-medium px-3 py-2">Valor</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selected.sales.map(s => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.sale_date)}</td>
                      <td className="px-3 py-2 font-medium">{s.products?.name || 'Venda'}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(s.amount_cents)}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma compra registrada.</p>
          )}
        </TabsContent>

      </Tabs>

      <TaskDialog
        orgSlug={orgSlug}
        defaultLead={{ id: c.id, name: c.name }}
        trigger={<button type="button" className="hidden" aria-hidden />}
        open={newTaskOpen}
        onOpenChange={(v: boolean) => setNewTaskOpen(v)}
      />
    </div>
  )
}

function ActivityRow({ act, fmtCurrency }: { act: any; fmtCurrency: (v: number) => string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs">
        {act.type === 'manual_created' ? '🚀' : act.type === 'note' ? '📝' : act.type === 'ai_qualified' ? '✨' : act.type.startsWith('email') ? '✉️' : act.type.startsWith('credit_') ? '🎫' : '⚙️'}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {act.type === 'manual_created' ? 'Contato criado manualmente'
            : act.type === 'note' ? 'Nota adicionada'
            : act.type === 'ai_qualified' ? `IA qualificou: ${act.payload?.tier?.toUpperCase()} (${act.payload?.score}/100)`
            : act.type === 'email_sent' ? 'E-mail enviado'
            : act.type === 'email_opened' ? 'E-mail aberto'
            : act.type === 'credit_created' ? `Crédito de cancelamento gerado: ${fmtCurrency(act.payload?.valor_cents || 0)} (${act.payload?.operadora})`
            : act.type === 'credit_used' ? `Crédito de cancelamento utilizado: ${fmtCurrency(act.payload?.valor_cents || 0)}`
            : act.type}
        </div>
        {act.type === 'note' && <div className="text-sm mt-1 whitespace-pre-wrap">{act.payload.text}</div>}
        {act.type === 'ai_qualified' && (
          <div className="text-xs mt-1 text-muted-foreground italic">
            {act.payload?.reason}
            {act.payload?.concerns?.length > 0 && <div className="mt-1">⚠ {act.payload.concerns.join(' · ')}</div>}
          </div>
        )}
        {act.type === 'email_sent' && <div className="text-xs mt-1 text-muted-foreground">Assunto: {act.payload.subject} (Template: {act.payload.template_name})</div>}
        <div className="text-[11px] text-muted-foreground mt-1">{new Date(act.created_at).toLocaleString('pt-BR')}</div>
      </div>
    </div>
  )
}

export function DealCard({ d, fmtCurrency, fmtDate }: { d: ContatoDeal; fmtCurrency: (v: number) => string; fmtDate: (v: string | null) => string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
      <div className="min-w-0">
        <span className={cn(
          'font-medium',
          d.status === 'won' && 'text-emerald-600',
          d.status === 'lost' && 'text-muted-foreground',
        )}>
          {d.status === 'won' ? 'Ganho' : d.status === 'lost' ? 'Perdido' : 'Em aberto'}
        </span>
        {d.stage_name && <span className="text-muted-foreground"> · {d.stage_name}</span>}
        <div className="text-xs text-muted-foreground">
          {fmtDate(d.won_at || d.lost_at || d.created_at)}
        </div>
      </div>
      <span className="font-semibold tabular-nums shrink-0">{fmtCurrency(d.value_cents || 0)}</span>
    </div>
  )
}

function Field({ icon: Icon, label, children, dense }: { icon: any; label: string; children: React.ReactNode; dense?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-background space-y-1', dense ? 'p-2' : 'p-3')}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={dense ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className={cn('font-bold uppercase tracking-wider', dense ? 'text-[9px]' : 'text-[10px]')}>{label}</span>
      </div>
      {children}
    </div>
  )
}

// ── Uploader de avatar ───────────────────────────────────────────────
function AvatarUploader({
  orgSlug, contatoId, name, url,
}: {
  orgSlug: string
  contatoId: string
  name: string
  url: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  // Optimistic local copy: reflects the just-uploaded/removed photo immediately,
  // so the avatar updates even if the server `router.refresh()` data lags or the
  // tab is running a slightly stale bundle. `undefined` = follow the server prop.
  const [localUrl, setLocalUrl] = useState<string | null | undefined>(undefined)

  // When the server prop changes (navigating between contatos), drop the override.
  useEffect(() => { setLocalUrl(undefined) }, [contatoId])

  const shownUrl = localUrl === undefined ? url : localUrl

  async function onFile(file: File) {
    setBusy(true)
    // Show the picked image instantly while the upload runs.
    const preview = URL.createObjectURL(file)
    setLocalUrl(preview)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadContatoAvatar(orgSlug, contatoId, fd)
    setBusy(false)
    if (!res.ok) { setLocalUrl(undefined); URL.revokeObjectURL(preview); toast.error(res.error); return }
    setLocalUrl(res.url)
    URL.revokeObjectURL(preview)
    toast.success('Foto atualizada.')
    router.refresh()
  }

  async function onRemove() {
    setBusy(true)
    const res = await removeContatoAvatar(orgSlug, contatoId)
    setBusy(false)
    if (!res.ok) { toast.error(res.error); return }
    setLocalUrl(null)
    toast.success('Foto removida.')
    router.refresh()
  }

  return (
    <div className="relative shrink-0 group">
      {shownUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shownUrl} alt={name} className="w-14 h-14 rounded-full object-cover" />
      ) : (
        <span className="w-14 h-14 rounded-full grid place-items-center bg-brand-100 text-brand-700 text-lg font-semibold">
          {initials(name)}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow ring-2 ring-card disabled:opacity-50"
        aria-label="Trocar foto"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
      </button>
      {shownUrl && !busy && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white grid place-items-center shadow ring-2 ring-card opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remover foto"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Diálogo de criação rápida ────────────────────────────────────────
function NewContatoDialog({
  orgSlug, onCreated,
}: {
  orgSlug: string
  onCreated: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<ContatoStatus>('lead')
  const [source, setSource] = useState('manual')
  const [saving, setSaving] = useState(false)

  function reset() {
    setName(''); setEmail(''); setPhone(''); setStatus('lead'); setSource('manual')
  }

  async function submit() {
    if (!name.trim()) { toast.error('Informe o nome.'); return }
    setSaving(true)
    const res = await createContato(orgSlug, { name, email, phone, status, source })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Contato criado.')
    setOpen(false)
    reset()
    onCreated(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" /> Contato
      </Button>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Novo contato</h2>
            <p className="text-sm text-muted-foreground">
              Endereço, documentos e foto você completa no painel depois de criar.
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Classificação</Label>
                <Select value={status} onValueChange={v => setStatus(v as ContatoStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_VALUES.map(s => (
                      <SelectItem key={s} value={s}>{CONTATO_STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Origem</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Cadastro manual</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="form">Formulário</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Criar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Sheet de filtros ─────────────────────────────────────────────────
function countActiveFilters(f: Filters): number {
  const keys = ['source', 'tag', 'tier', 'has_email', 'has_phone', 'no_contact_days',
    'created_from', 'created_to', 'value_min', 'value_max', 'pipeline_id', 'stage']
  return keys.reduce((n, k) => n + (f[k] ? 1 : 0), 0)
}

function FiltersSheet({
  filters, allTags, allSources, pipelines, activeCount, onApply, onClear,
}: {
  filters: Filters
  allTags: string[]
  allSources: string[]
  pipelines: { id: string; name: string; is_default: boolean }[]
  activeCount: number
  onApply: (patch: Record<string, string | null>) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Filters>(filters)
  useEffect(() => { if (open) setDraft(filters) }, [open, filters])

  function set(k: string, v: string) {
    setDraft(d => ({ ...d, [k]: v }))
  }
  function apply() {
    const patch: Record<string, string | null> = {}
    for (const k of ['source', 'tag', 'tier', 'has_email', 'has_phone', 'no_contact_days',
      'created_from', 'created_to', 'value_min', 'value_max', 'pipeline_id']) {
      patch[k] = draft[k] ? String(draft[k]) : null
    }
    onApply(patch)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Filtros
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Origem</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.source || ''}
              onChange={e => set('source', e.target.value)}
            >
              <option value="">Todas</option>
              {allSources.map(s => (
                <option key={s} value={s}>{contatoSourceLabel(s)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tag</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.tag || ''}
              onChange={e => set('tag', e.target.value)}
            >
              <option value="">Todas</option>
              {allTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Funil</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.pipeline_id || ''}
              onChange={e => set('pipeline_id', e.target.value)}
            >
              <option value="">Todos</option>
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Classificação IA</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.tier || ''}
              onChange={e => set('tier', e.target.value)}
            >
              <option value="">Todas</option>
              <option value="hot">Quente</option>
              <option value="warm">Morno</option>
              <option value="cold">Frio</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-primary"
                checked={draft.has_email === '1'}
                onChange={e => set('has_email', e.target.checked ? '1' : '')}
              />
              Com e-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-primary"
                checked={draft.has_phone === '1'}
                onChange={e => set('has_phone', e.target.checked ? '1' : '')}
              />
              Com telefone
            </label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Sem contato há (dias)</Label>
            <Input
              type="number" min={0}
              value={draft.no_contact_days || ''}
              onChange={e => set('no_contact_days', e.target.value)}
              placeholder="ex.: 30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Criado de</Label>
              <Input type="date" value={draft.created_from || ''} onChange={e => set('created_from', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Criado até</Label>
              <Input type="date" value={draft.created_to || ''} onChange={e => set('created_to', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor mín. (R$)</Label>
              <Input type="number" min={0} value={draft.value_min || ''} onChange={e => set('value_min', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor máx. (R$)</Label>
              <Input type="number" min={0} value={draft.value_max || ''} onChange={e => set('value_max', e.target.value)} />
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row justify-between gap-2">
          <Button variant="ghost" onClick={() => { onClear(); setOpen(false) }}>Limpar tudo</Button>
          <Button onClick={apply}>Aplicar filtros</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Menu de filtros salvos ───────────────────────────────────────────
function SavedFilterMenu({
  orgSlug, savedFilters, filters, onApply,
}: {
  orgSlug: string
  savedFilters: SavedFilter[]
  filters: Filters
  onApply: (config: Record<string, string | null>) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function hasActiveFilters(): boolean {
    return Object.entries(filters).some(([k, v]) => v && k !== 'sel' && k !== 'page')
  }

  async function save() {
    const name = window.prompt('Nome do filtro salvo:')
    if (!name?.trim()) return
    const config: Record<string, string> = {}
    for (const [k, v] of Object.entries(filters)) {
      if (v && k !== 'sel' && k !== 'page') config[k] = String(v)
    }
    const res = await createSavedFilter(orgSlug, { name: name.trim(), entity: 'leads', config })
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Filtro salvo.')
    router.refresh()
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteSavedFilter(orgSlug, id)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Filtro removido.')
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Bookmark className="w-4 h-4 mr-1.5" /> Salvos
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Filtros salvos</DropdownMenuLabel>
        {savedFilters.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum filtro salvo.</div>
        )}
        {savedFilters.map(f => (
          <div key={f.id} className="flex items-center gap-1 px-1">
            <DropdownMenuItem
              className="flex-1"
              onSelect={() => {
                const config: Record<string, string | null> = {
                  q: null, source: null, tag: null, tier: null, has_email: null, has_phone: null,
                  no_contact_days: null, created_from: null, created_to: null,
                  value_min: null, value_max: null, pipeline_id: null, stage: null,
                  ...(f.config as Record<string, string>),
                }
                onApply(config)
              }}
            >
              {f.name}
            </DropdownMenuItem>
            <button
              className="p-1 text-muted-foreground hover:text-destructive"
              onClick={() => remove(f.id)}
              disabled={pending}
              aria-label="Remover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasActiveFilters()} onSelect={() => save()}>
          <Plus className="w-4 h-4 mr-1.5" /> Salvar filtro atual
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
