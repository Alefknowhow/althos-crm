'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { IgIcon, WhatsAppIcon } from './ConversasChannelIcons'
import type { UnifiedConversationRow } from '@/lib/conversas/unify'

/**
 * Barra lateral única de Conversas — WhatsApp + Instagram intercalados
 * numa só lista, ordenados por atividade recente, cada linha com o ícone
 * do canal de origem. Substitui as sidebars internas de WhatsappChat/
 * SocialInbox quando ambas são renderizadas com hideSidebar.
 */
export default function UnifiedConversasSidebar({
  orgSlug, rows, selectedId, hasComentarios, unreadComentarios = 0,
}: {
  orgSlug: string
  rows: UnifiedConversationRow[]
  selectedId?: string | null
  hasComentarios: boolean
  unreadComentarios?: number
}) {
  return (
    <div className="w-full md:w-[360px] shrink-0 border-r border-border bg-background flex flex-col h-full">
      <div className="h-16 px-4 border-b border-border flex items-center justify-between shrink-0">
        <span className="font-semibold text-sm">Conversas</span>
        {hasComentarios && (
          <Link
            href={`/app/${orgSlug}/conversas?ch=comentarios`}
            className="relative flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comentários
            {unreadComentarios > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {unreadComentarios > 9 ? '9+' : unreadComentarios}
              </span>
            )}
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa ainda.</div>
        )}
        {rows.map(row => {
          const isSelected = row.id === selectedId
          return (
            <Link
              key={`${row.channel}-${row.id}`}
              href={`/app/${orgSlug}/conversas?id=${row.id}&ch=${row.channel}`}
              className={`flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/50 ${isSelected ? 'bg-accent' : ''}`}
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
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                  {row.channel === 'whatsapp' ? <WhatsAppIcon /> : <IgIcon />}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${row.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>{row.name}</span>
                </div>
                <p className={`text-xs truncate ${row.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {row.preview || '—'}
                </p>
              </div>
              {row.unreadCount > 0 && (
                <span className="shrink-0 bg-primary text-primary-foreground text-[10px] leading-none rounded-full w-5 h-5 flex items-center justify-center">
                  {row.unreadCount > 9 ? '9+' : row.unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
