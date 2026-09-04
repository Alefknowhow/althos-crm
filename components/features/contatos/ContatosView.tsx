'use client'

/**
 * Split across five files (this one has the list + top bar component):
 *   - ContatosViewShared.ts: types + small formatting helpers
 *   - ContatosViewWidgets.tsx: ShortcutButton, LinkedRecordsDialog,
 *     EmptyLinked, ListAvatar, AvatarUploader, NewContatoDialog
 *   - ContatosViewDetailPanel.tsx: the contact detail side panel
 *   - ContatosViewFilters.tsx: the filters sheet + saved-filter menu
 */

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { cn, formatPhoneDisplay } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search, FileCheck2, Phone, Users, MessageCircle, FileSignature, Plane,
} from 'lucide-react'
import { CONTATO_STATUS_META, type ContatoStatus } from '@/lib/contatos'
import { getOrCreateConversationForLead } from '@/actions/whatsapp'
import {
  type ListRow, type Props,
  relativeTime,
} from './ContatosViewShared'
import { ShortcutButton, LinkedRecordsDialog, ListAvatar, NewContatoDialog } from './ContatosViewWidgets'
import { DetailPanel } from './ContatosViewDetailPanel'
import { FiltersSheet, countActiveFilters } from './ContatosViewFilters'

export { DealCard } from './ContatosViewDetailPanel'

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
