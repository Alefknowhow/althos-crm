'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  MessageSquare, Search, MoreVertical, MessageCircle, MessageCircleMore, Archive, Bot,
  Users, Filter as FilterIcon, FileStack,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ConfigurarAgenteIaDialog from './ConfigurarAgenteIaDialog'
import UnifiedConversaRow from './UnifiedConversaRow'
import type { UnifiedConversationRow } from '@/lib/conversas/unify'

type InboxView = 'all' | 'unread' | 'archived'
type ChannelTab = 'all' | 'whatsapp' | 'instagram'

/**
 * Barra lateral única de Conversas — WhatsApp + Instagram intercalados
 * numa só lista, ordenados por atividade recente, cada linha com o ícone
 * do canal de origem (cor de marca), responsável e etapa do pipeline.
 * Substitui as sidebars internas de WhatsappChat/SocialInbox quando ambas
 * são renderizadas com hideSidebar.
 */
export default function UnifiedConversasSidebar({
  orgSlug, rows, selectedId, hasComentarios, unreadComentarios = 0, members = [], pipelineStages = [],
}: {
  orgSlug: string
  rows: UnifiedConversationRow[]
  selectedId?: string | null
  hasComentarios: boolean
  unreadComentarios?: number
  members?: { user_id: string; name: string; email: string }[]
  pipelineStages?: { id: string; name: string }[]
}) {
  const [query, setQuery] = useState('')
  const [inboxView, setInboxView] = useState<InboxView>('all')
  const [channelTab, setChannelTab] = useState<ChannelTab>('all')
  const [filterResponsavel, setFilterResponsavel] = useState<string>('all')
  const [filterStage, setFilterStage] = useState<string>('all')
  const [aiDialogOpen, setAiDialogOpen] = useState(false)

  // Contagem regressiva da janela de 24h do WhatsApp (WindowBadge) — atualiza
  // a cada 30s pra todas as linhas sem precisar de um setInterval por linha.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const unreadCount = rows.filter(r => !r.archived && r.unreadCount > 0).length
  const stageNames = useMemo(
    () => Array.from(new Set(pipelineStages.map(s => s.name))).sort(),
    [pipelineStages],
  )

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if (inboxView === 'unread' && !(row.unreadCount > 0 && !row.archived)) return false
      if (inboxView === 'archived' && !row.archived) return false
      if (inboxView === 'all' && row.archived) return false
      if (channelTab !== 'all' && row.channel !== channelTab) return false
      if (filterResponsavel !== 'all') {
        if (filterResponsavel === '__none') { if (row.assignedTo) return false }
        else if (row.assignedTo !== filterResponsavel) return false
      }
      if (filterStage !== 'all' && row.stageName !== filterStage) return false
      if (q && !row.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, query, inboxView, channelTab, filterResponsavel, filterStage])

  const hasActiveFilters = filterResponsavel !== 'all' || filterStage !== 'all'
  const memberById = new Map(members.map(m => [m.user_id, m]))

  return (
    <div className="w-full md:w-[360px] shrink-0 border-r border-border bg-background flex flex-col h-full">
      <div className="h-14 px-4 border-b border-border flex items-center justify-between shrink-0">
        <span className="font-semibold text-sm">Conversas</span>
        <div className="flex items-center gap-1">
          {hasComentarios && (
            <Link
              href={`/app/${orgSlug}/conversas?ch=comentarios`}
              className="relative flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {unreadComentarios > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadComentarios > 9 ? '9+' : unreadComentarios}
                </span>
              )}
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
                title="Mais opções"
                aria-label="Mais opções"
              >
                <MoreVertical className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setInboxView('all')} className="gap-2">
                <MessageCircle className="w-4 h-4" /> Todas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInboxView('unread')} className="gap-2">
                <MessageCircleMore className="w-4 h-4" /> Não lidas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInboxView('archived')} className="gap-2">
                <Archive className="w-4 h-4" /> Arquivadas
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="gap-2">
                <Link href={`/app/${orgSlug}/whatsapp-templates`}>
                  <FileStack className="w-4 h-4" /> Templates de WhatsApp
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiDialogOpen(true)} className="gap-2">
                <Bot className="w-4 h-4" /> Configurar agente de IA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Abas de canal */}
      <div className="px-3 pt-2.5 pb-2 border-b border-border shrink-0">
        <div className="inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5">
          {([
            { value: 'all', label: 'Todos' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'instagram', label: 'Instagram' },
          ] as const).map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setChannelTab(tab.value)}
              className={cn(
                'px-3 h-7 rounded-full text-xs font-medium transition-colors',
                channelTab === tab.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Busca + filtros (responsável / estágio) */}
      <div className="px-3 py-2.5 border-b border-border shrink-0 flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="h-9 w-full rounded-full border border-input bg-muted/50 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative h-9 w-9 shrink-0 flex items-center justify-center rounded-full border hover:bg-muted',
                filterResponsavel !== 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground',
              )}
              title="Filtrar por responsável"
              aria-label="Filtrar por responsável"
            >
              <Users className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              <button
                type="button"
                onClick={() => setFilterResponsavel('all')}
                className={cn('w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted', filterResponsavel === 'all' && 'bg-muted font-medium')}
              >
                Todos responsáveis
              </button>
              <button
                type="button"
                onClick={() => setFilterResponsavel('__none')}
                className={cn('w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted', filterResponsavel === '__none' && 'bg-muted font-medium')}
              >
                Sem responsável
              </button>
              {members.map(m => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => setFilterResponsavel(m.user_id)}
                  className={cn('w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted truncate', filterResponsavel === m.user_id && 'bg-muted font-medium')}
                >
                  {m.name || m.email}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative h-9 w-9 shrink-0 flex items-center justify-center rounded-full border hover:bg-muted',
                filterStage !== 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground',
              )}
              title="Filtrar por estágio do pipeline"
              aria-label="Filtrar por estágio do pipeline"
            >
              <FilterIcon className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              <button
                type="button"
                onClick={() => setFilterStage('all')}
                className={cn('w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted', filterStage === 'all' && 'bg-muted font-medium')}
              >
                Todas as etapas
              </button>
              {stageNames.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFilterStage(name)}
                  className={cn('w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted truncate', filterStage === name && 'bg-muted font-medium')}
                >
                  {name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters && (
        <div className="px-3 py-1.5 border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => { setFilterResponsavel('all'); setFilterStage('all') }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {visibleRows.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>
        )}
        {visibleRows.map(row => (
          <UnifiedConversaRow
            key={`${row.channel}-${row.id}`}
            row={row}
            orgSlug={orgSlug}
            isSelected={row.id === selectedId}
            responsavel={row.assignedTo ? memberById.get(row.assignedTo) ?? null : null}
            now={now}
          />
        ))}
      </div>

      <ConfigurarAgenteIaDialog orgSlug={orgSlug} open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </div>
  )
}
