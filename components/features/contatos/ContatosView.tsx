'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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
  Search, SlidersHorizontal, Plus, Loader2, ChevronLeft, ExternalLink, Mail, Phone,
  MapPin, FileCheck2, Users, Wallet, CalendarClock, Tag as TagIcon, Camera, Trash2,
  Bookmark, X, MessageCircle, FileSignature, Plane,
} from 'lucide-react'
import {
  CONTATO_STATUSES, CONTATO_STATUS_META, contatoSourceLabel, type ContatoStatus,
} from '@/lib/contatos'
import {
  createContato, setContatoStatus, uploadContatoAvatar, removeContatoAvatar,
  getContatoTravelLinks, type ContatoQuoteLink, type ContatoReservationLink,
} from '@/actions/contatos'
import { createSavedFilter, deleteSavedFilter, type SavedFilter } from '@/actions/saved_filters'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import CustomerDocuments from '@/components/features/customers/CustomerDocuments'
import ContatoRelationships from '@/components/features/contatos/ContatoRelationships'

/* eslint-disable @typescript-eslint/no-explicit-any */

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
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, e-mail ou telefone..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <FiltersSheet
          filters={filters}
          allTags={allTags}
          allSources={allSources}
          pipelines={pipelines}
          activeCount={activeFilterCount}
          onApply={patch => router.push(buildUrl({ ...patch, page: null, sel: null }))}
          onClear={() => router.push(pathname)}
        />

        <SavedFilterMenu
          orgSlug={orgSlug}
          savedFilters={savedFilters}
          filters={filters}
          onApply={config => router.push(buildUrl({ ...config, page: null, sel: null }))}
        />

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground tabular-nums">
          {total} contato(s)
        </span>

        <NewContatoDialog
          orgSlug={orgSlug}
          onCreated={id => selectRow(id)}
        />
      </div>

      {/* ── Master-detail ───────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-260px)] lg:min-h-[480px]">
        {/* Master */}
        <div
          className={cn(
            'lg:w-[360px] lg:shrink-0 rounded-xl border bg-card flex flex-col overflow-hidden',
            mobileDetail && 'hidden lg:flex',
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
                        {c.phone || 'Sem telefone'}
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
                      asChild
                      label="Conversas"
                      icon={MessageCircle}
                    >
                      <Link href={`/app/${orgSlug}/conversas?lead=${c.id}`} aria-label="Conversas">
                        <MessageCircle className="w-4 h-4" />
                      </Link>
                    </ShortcutButton>
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
            'lg:flex-1 lg:min-w-0 rounded-xl border bg-card overflow-y-auto',
            !mobileDetail && 'hidden lg:block',
          )}
        >
          {selected ? (
            <DetailPanel
              key={selected.contato.id}
              orgSlug={orgSlug}
              selected={selected}
              onBack={() => setMobileDetail(false)}
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
  orgSlug, selected, onBack,
}: {
  orgSlug: string
  selected: NonNullable<Selected>
  onBack: () => void
}) {
  const router = useRouter()
  const c = selected.contato
  const stageName = c.pipeline_stages?.name as string | undefined
  const [savingStatus, startStatus] = useTransition()

  const completedSales = selected.sales.filter(s => s.status === 'completed')
  const totalPurchased = completedSales.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const lastPurchase = completedSales[0]?.sale_date || null

  function changeStatus(value: string) {
    startStatus(async () => {
      const res = await setContatoStatus(orgSlug, c.id, value)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Classificação atualizada.')
      router.refresh()
    })
  }

  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="lg:hidden mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <AvatarUploader orgSlug={orgSlug} contatoId={c.id} name={c.name} url={c.avatar_url} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold leading-tight break-words">{c.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
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

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/app/${orgSlug}/contatos/${c.id}`}>
            <ExternalLink className="w-4 h-4 mr-1.5" /> Página completa
          </Link>
        </Button>
        {c.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`https://wa.me/${onlyDigits(c.phone)}`} target="_blank" rel="noopener noreferrer">
              <Phone className="w-4 h-4 mr-1.5" /> WhatsApp
            </a>
          </Button>
        )}
        {c.email && (
          <Button size="sm" variant="outline" asChild>
            <a href={`mailto:${c.email}`}>
              <Mail className="w-4 h-4 mr-1.5" /> E-mail
            </a>
          </Button>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <Field icon={Wallet} label="Total comprado">
          <span className="text-2xl font-bold text-primary">{fmtCurrency(totalPurchased)}</span>
        </Field>
        <Field icon={CalendarClock} label="Última compra">
          <span className="text-2xl font-bold">{fmtDate(lastPurchase)}</span>
        </Field>
      </div>

      {/* Contato + localização (complementar — sem duplicar a lista) */}
      <div className="grid grid-cols-2 gap-3">
        <Field icon={Mail} label="E-mail">
          <span className="text-sm font-medium break-all">{c.email || '—'}</span>
        </Field>
        <Field icon={Phone} label="Telefone">
          <span className="text-sm font-medium">{c.phone || '—'}</span>
        </Field>
        <Field icon={MapPin} label="Localização">
          <span className="text-sm font-medium">
            {c.city || c.state ? [c.city, c.state].filter(Boolean).join(' · ') : '—'}
          </span>
        </Field>
        <Field icon={CalendarClock} label="Criado em">
          <span className="text-sm font-medium">{fmtDate(c.created_at)}</span>
        </Field>
      </div>

      {/* Tags */}
      {Array.isArray(c.tags) && c.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-muted-foreground" />
          {c.tags.map((t: string) => (
            <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
          ))}
        </div>
      )}

      {/* Cadastro: endereço, documentos, passaporte */}
      <CustomerProfileForm orgSlug={orgSlug} leadId={c.id} initial={c} />

      {/* Documentos (fotos / arquivos) */}
      <CustomerDocuments
        orgSlug={orgSlug}
        leadId={c.id}
        profileId={c.id}
        initialDocuments={selected.documents}
      />

      {/* Parentesco */}
      <ContatoRelationships orgSlug={orgSlug} contatoId={c.id} initial={selected.relationships} />

      {/* Histórico de compras */}
      {selected.sales.length > 0 && (
        <div className="rounded-xl border">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Compras</div>
          <div className="divide-y">
            {selected.sales.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.products?.name || 'Venda'}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(s.sale_date)}</div>
                </div>
                <span className="font-semibold tabular-nums">{fmtCurrency(s.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
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
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
