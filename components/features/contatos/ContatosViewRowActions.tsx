'use client'

/**
 * Ações rápidas da linha da lista de Contatos — só ícone (Conversas/Ligar/
 * SMS/E-mail/Cotações/Reservas) + o menu ⋮ com Editar/Excluir. Extraído de
 * ContatosView.tsx (que ficou grande demais).
 */

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MessageCircle, FileSignature, Plane, PhoneCall, MessageSquareText,
  MoreVertical, Mail, Pencil, Trash2,
} from 'lucide-react'
import type { ListRow } from './ContatosViewShared'

const ICON_BTN = 'w-7 h-7 grid place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'

export function ContatosViewRowActions({
  c, isTravel, conversationLoading, deleting,
  onOpenConversation, onCall, onSms, onShowQuotes, onShowReservations, onEdit, onDelete,
}: {
  c: ListRow
  isTravel: boolean
  conversationLoading: boolean
  deleting: boolean
  onOpenConversation: () => void
  onCall: () => void
  onSms: () => void
  onShowQuotes: () => void
  onShowReservations: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
      <button type="button" title="Conversas" onClick={onOpenConversation} disabled={conversationLoading} className={`${ICON_BTN} disabled:opacity-50`}>
        <MessageCircle className="w-4 h-4" />
      </button>
      {c.phone && (
        <button type="button" title="Ligar" onClick={onCall} className={ICON_BTN}>
          <PhoneCall className="w-4 h-4" />
        </button>
      )}
      {c.phone && (
        <button type="button" title="SMS" onClick={onSms} className={ICON_BTN}>
          <MessageSquareText className="w-4 h-4" />
        </button>
      )}
      {c.email && (
        <a href={`mailto:${c.email}`} title="E-mail" className={ICON_BTN}>
          <Mail className="w-4 h-4" />
        </a>
      )}
      {isTravel && (
        <>
          <button type="button" title="Cotações enviadas" onClick={onShowQuotes} className={ICON_BTN}>
            <FileSignature className="w-4 h-4" />
          </button>
          <button type="button" title="Reservas" onClick={onShowReservations} className={ICON_BTN}>
            <Plane className="w-4 h-4" />
          </button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={ICON_BTN} aria-label="Mais ações">
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete} disabled={deleting}>
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir contato
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
