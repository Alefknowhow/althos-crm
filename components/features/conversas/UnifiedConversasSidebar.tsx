'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  MessageSquare, Search, MoreVertical, MessageCircle, MessageCircleMore, Archive, Bot,
  Users, Filter as FilterIcon,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { agentColor, memberShortLabel } from '@/components/features/ConversationDetailPanel'
import { IgIcon, WhatsAppIcon } from './ConversasChannelIcons'
import ConfigurarAgenteIaDialog from './ConfigurarAgenteIaDialog'
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
        {visibleRows.map(row => {
          const isSelected = row.id === selectedId
          const responsavel = row.assignedTo ? memberById.get(row.assignedTo) : null
          return (
            <Link
              key={`${row.channel}-${row.id}`}
              href={`/app/${orgSlug}/conversas?id=${row.id}&ch=${row.channel}`}
              className={cn('flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/50', isSelected && 'bg-accent')}
            >
              <div className="relative shrink-0">
                {row.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {row.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background">
                  {row.channel === 'whatsapp' ? <WhatsAppIcon className="w-4 h-4" /> : <IgIcon className="w-4 h-4" />}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm truncate', row.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>{row.name}</span>
                  {row.lastMessageAt && (
                    <span className={cn('text-[10px] shrink-0', row.unreadCount > 0 ? 'text-primary font-medium' : 'text-muted-foreground')}>
                      {formatRelativeTime(row.lastMessageAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-xs truncate flex-1', row.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                    {row.preview || '—'}
                  </p>
                  {row.unreadCount > 0 && (
                    <span className="shrink-0 bg-primary text-primary-foreground text-[10px] leading-none rounded-full w-5 h-5 flex items-center justify-center">
                      {row.unreadCount > 9 ? '9+' : row.unreadCount}
                    </span>
                  )}
                </div>
                {(responsavel || row.stageName) && (
                  <div className="flex items-center gap-1.5">
                    {responsavel && (
                      <span className={cn('h-2 w-2 rounded-full shrink-0', agentColor(row.assignedTo))} title={`Responsável: ${responsavel.name || responsavel.email}`} />
                    )}
                    {responsavel && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">{memberShortLabel(responsavel.name, responsavel.email)}</span>
                    )}
                    {row.stageName && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white truncate max-w-[110px]"
                        style={{ backgroundColor: row.stageColor || '#8a3ffc' }}
                      >
                        {row.stageName}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      <ConfigurarAgenteIaDialog orgSlug={orgSlug} open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
