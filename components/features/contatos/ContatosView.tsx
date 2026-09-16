'use client'

/**
 * Split across five files (this one has the list + top bar component):
 *   - ContatosViewShared.ts: types + small formatting helpers
 *   - ContatosViewWidgets.tsx: ShortcutButton, LinkedRecordsDialog,
 *     EmptyLinked, ListAvatar, AvatarUploader, NewContatoDialog
 *   - ContatosViewDetailPanel.tsx: the contact detail page
 *   - ContatosViewFilters.tsx: the filters sheet + saved-filter menu
 *
 * Layout: single pane, como no /design — lista em tela cheia OU painel
 * do cliente em tela cheia, nunca os dois lado a lado (era split-view
 * antes; o novo design system não usa mais esse padrão).
 */

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { cn, formatPhoneDisplay } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, Users, MessageCircle, FileSignature, Plane, PhoneCall, MessageSquareText,
  MoreVertical,
} from 'lucide-react'
import { useCallDialer } from '@/components/features/voice/CallDialerModal'
import { useSmsComposer } from '@/components/features/voice/SmsComposeModal'
import { CONTATO_STATUS_META, type ContatoStatus } from '@/lib/contatos'
import { getOrCreateConversationForLead } from '@/actions/whatsapp'
import {
  type ListRow, type Props, relativeTime, initials,
} from './ContatosViewShared'
import { ListAvatar, LinkedRecordsDialog, NewContatoDialog } from './ContatosViewWidgets'
import { DetailPanel } from './ContatosViewDetailPanel'
import { FiltersSheet, countActiveFilters } from './ContatosViewFilters'

export { DealCard } from './ContatosViewDetailPanel'

export default function ContatosView({
  orgSlug,
  contatos,
  selected,
  total,
  page,
  pageSize,
  pipelines,
  allTags,
  allSources,
  savedFilters: _savedFilters,
  filters,
  isTravel,
  isRealEstate,
  properties = [],
  members,
  statusTabs,
  responsavelFilter,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
    navigate({ sel: id })
  }

  const openDialer = useCallDialer()
  const openSms = useSmsComposer()
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
  const membersById: Record<string, { id: string; name: string }> = {}
  for (const m of members) membersById[m.id] = m

  // ── Painel do cliente — tela cheia, substitui a lista inteira ─────
  if (selected) {
    return (
      <DetailPanel
        key={selected.contato.id}
        orgSlug={orgSlug}
        selected={selected}
        onBack={() => navigate({ sel: null })}
        members={members}
        isTravel={isTravel}
        isRealEstate={isRealEstate}
        properties={properties}
      />
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-xl font-bold shrink-0">
          Contatos <span className="text-muted-foreground font-medium text-base">· {total}</span>
        </h1>

        <div className="flex-1" />

        <div className="relative min-w-[160px] flex-1 sm:flex-none sm:w-[240px] order-last sm:order-none basis-full sm:basis-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-10 h-9 rounded-full bg-card border-transparent shadow-[0_1px_2px_rgba(0,0,0,.05)]"
          />
        </div>

        {statusTabs}
        {responsavelFilter}

        <FiltersSheet
          filters={filters}
          allTags={allTags}
          allSources={allSources}
          pipelines={pipelines}
          activeCount={activeFilterCount}
          onApply={patch => router.push(buildUrl({ ...patch, page: null, sel: null }))}
          onClear={() => router.push(pathname)}
        />

        <NewContatoDialog orgSlug={orgSlug} onCreated={id => selectRow(id)} />
      </div>

      {/* ── Tabela ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 rounded-lg bg-card overflow-hidden flex flex-col">
        {/* Cabeçalho — só desktop, a lista mobile usa cards empilhados */}
        <div className="hidden md:grid grid-cols-[1fr_140px_150px_170px_120px_40px] gap-3 px-4 py-2.5 border-b border-border/60 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
          <div>Contato</div>
          <div>Etapa</div>
          <div>Telefone</div>
          <div>Responsável</div>
          <div>Último contato</div>
          <div />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {contatos.map(c => {
            const meta = CONTATO_STATUS_META[(c.status as ContatoStatus)] || null
            const responsible = c.assigned_to ? membersById[c.assigned_to] : null
            return (
              <div
                key={c.id}
                onClick={() => selectRow(c.id)}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_150px_170px_120px_40px] gap-2 md:gap-3 items-center px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40"
              >
                {/* Contato */}
                <div className="flex items-center gap-3 min-w-0">
                  <ListAvatar name={c.name} url={c.avatar_url} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.name}</div>
                    {c.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
                  </div>
                </div>

                {/* Etapa */}
                <div className="md:contents">
                  {meta && (
                    <span className={cn('inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold', meta.badgeClass)}>
                      {meta.label}
                    </span>
                  )}
                </div>

                {/* Telefone */}
                <div className="text-sm text-muted-foreground truncate">
                  {c.phone ? formatPhoneDisplay(c.phone) : '—'}
                </div>

                {/* Responsável */}
                <div className="flex items-center gap-2 min-w-0">
                  {responsible ? (
                    <>
                      <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-semibold shrink-0 grid place-items-center">
                        {initials(responsible.name)}
                      </span>
                      <span className="text-sm truncate">{responsible.name}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                {/* Último contato */}
                <div className="text-sm text-muted-foreground">
                  {relativeTime(c.last_activity_at || c.updated_at)}
                </div>

                {/* Kebab — atalhos rápidos, sem sair da lista */}
                <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-7 h-7 grid place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        aria-label="Ações rápidas"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenConversation(c.id)}>
                        <MessageCircle className="w-3.5 h-3.5 mr-2" /> Conversas
                      </DropdownMenuItem>
                      {c.phone && (
                        <DropdownMenuItem onClick={() => openDialer({ contatoId: c.id, name: c.name, phone: c.phone! })}>
                          <PhoneCall className="w-3.5 h-3.5 mr-2" /> Ligar
                        </DropdownMenuItem>
                      )}
                      {c.phone && (
                        <DropdownMenuItem onClick={() => openSms({ contatoId: c.id, name: c.name, phone: c.phone! })}>
                          <MessageSquareText className="w-3.5 h-3.5 mr-2" /> SMS
                        </DropdownMenuItem>
                      )}
                      {isTravel && (
                        <>
                          <DropdownMenuItem onClick={() => setLinksFor({ kind: 'quotes', contato: c })}>
                            <FileSignature className="w-3.5 h-3.5 mr-2" /> Cotações enviadas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLinksFor({ kind: 'reservations', contato: c })}>
                            <Plane className="w-3.5 h-3.5 mr-2" /> Reservas
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
          {contatos.length === 0 && (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Users className="w-8 h-8 opacity-40" />
              Nenhum contato corresponde aos filtros.
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground shrink-0">
            <span className="tabular-nums">{rangeStart}–{rangeEnd} de {total}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => navigate({ page: String(currentPage - 1), sel: null })}
                className="h-7 px-3 rounded-full text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Anterior
              </button>
              <span className="px-1 tabular-nums">{currentPage}/{totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => navigate({ page: String(currentPage + 1), sel: null })}
                className="h-7 px-3 rounded-full text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
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
