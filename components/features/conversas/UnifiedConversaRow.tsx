'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { agentColor, memberShortLabel } from '@/components/features/ConversationDetailPanel'
import { ConversationTicks, WindowBadge, formatInboxTime } from '@/components/features/WhatsappChatWidgets'
import { IgIcon, WhatsAppIcon } from './ConversasChannelIcons'
import type { UnifiedConversationRow } from '@/lib/conversas/unify'

/**
 * Uma linha da lista unificada de Conversas — extraído de
 * UnifiedConversasSidebar.tsx só por tamanho de arquivo (limite de 350
 * linhas do projeto), sem mudança de comportamento. 3 linhas em posições
 * fixas: nome+janela/hora, prévia+tique+não-lidas, etapa(esquerda)/
 * responsável(direita).
 */
export default function UnifiedConversaRow({
  row, orgSlug, isSelected, responsavel, now,
}: {
  row: UnifiedConversationRow
  orgSlug: string
  isSelected: boolean
  responsavel: { user_id: string; name: string; email: string } | null
  now: number
}) {
  return (
    <Link
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
        {/* Linha 1 — nome à esquerda; janela de 24h (só WhatsApp) + hora à direita */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-sm truncate', row.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>{row.name}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {row.channel === 'whatsapp' && <WindowBadge lastInboundAt={row.lastInboundAt} now={now} />}
            {row.lastMessageAt && (
              <span className={cn('text-[10px]', row.unreadCount > 0 ? 'text-primary font-medium' : 'text-muted-foreground')}>
                {formatInboxTime(row.lastMessageAt)}
              </span>
            )}
          </div>
        </div>

        {/* Linha 2 — última mensagem (com tique de status se for nossa) + badge de não lidas */}
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-xs truncate flex-1 flex items-center gap-1', row.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
            {row.lastMessageDirection === 'outbound' && <ConversationTicks status={row.lastMessageStatus} />}
            <span className="truncate">{row.preview || '—'}</span>
          </p>
          {row.unreadCount > 0 && (
            <span className="shrink-0 bg-primary text-primary-foreground text-[10px] leading-none rounded-full w-5 h-5 flex items-center justify-center">
              {row.unreadCount > 9 ? '9+' : row.unreadCount}
            </span>
          )}
        </div>

        {/* Linha 3 — etapa do pipeline (esquerda) / responsável (direita), em
            posições fixas: cada etiqueta sempre ancorada na sua ponta,
            independente do tamanho do texto. */}
        {(responsavel || row.stageName) && (
          <div className="flex items-center justify-between gap-2">
            {row.stageName ? (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white truncate max-w-[110px]"
                style={{ backgroundColor: row.stageColor || '#8a3ffc' }}
              >
                {row.stageName}
              </span>
            ) : <span />}
            {responsavel && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className={cn('h-2 w-2 rounded-full shrink-0', agentColor(row.assignedTo))} title={`Responsável: ${responsavel.name || responsavel.email}`} />
                <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">{memberShortLabel(responsavel.name, responsavel.email)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
