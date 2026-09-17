'use client'

import { Switch } from '@/components/ui/switch'
import { MoreVertical, Archive, BellOff, Bell, Pin, PinOff, Star, MailQuestion, Eraser, Trash2, Ban } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { setConversationArchived, setConversationMuted, setConversationPinned, setConversationFavorite } from '@/actions/whatsapp'

export default function WhatsappChatHeader({
  orgSlug, router, selectedConversation, lastSeen, aiEnabledGlobally, pausingAi,
  handleToggleAi, showSearch, setShowSearch, setMsgQuery, handleToggleFlag, handleMarkUnread, setConfirmAction,
}: any) {
  return (
    <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex justify-between items-center gap-2 h-16 shrink-0 overflow-hidden z-10">
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <button
          type="button"
          onClick={() => router.push(`/app/${orgSlug}/conversas`)}
          className="md:hidden shrink-0 -ml-1 p-1 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Voltar para a lista"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate block min-w-0 max-w-[140px] sm:max-w-[260px]">{selectedConversation.contact_name || selectedConversation.contact_phone}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{lastSeen || selectedConversation.contact_phone}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {aiEnabledGlobally && (
          <span className="hidden sm:flex items-center gap-1.5 mr-1" title={selectedConversation.automation_paused ? 'IA pausada nesta conversa — você está no controle.' : 'IA ativa nesta conversa.'}>
            <span className="text-[11px] text-muted-foreground">{selectedConversation.automation_paused ? 'IA pausada' : 'IA ativa'}</span>
            <Switch
              checked={!selectedConversation.automation_paused}
              onCheckedChange={handleToggleAi}
              disabled={pausingAi}
            />
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowSearch((v: boolean) => { if (v) setMsgQuery(''); return !v })}
          className={`h-9 w-9 flex items-center justify-center rounded-full shadow-sm border border-border hover:bg-muted transition-colors ${showSearch ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground'}`}
          title="Pesquisar nesta conversa"
          aria-label="Pesquisar nesta conversa"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-9 w-9 flex items-center justify-center rounded-full shadow-sm border border-border bg-background hover:bg-muted text-muted-foreground transition-colors"
              title="Mais opções"
              aria-label="Mais opções"
            >
              <MoreVertical className="w-[18px] h-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleToggleFlag(setConversationArchived, 'archived', !selectedConversation.archived, selectedConversation.archived ? 'Conversa desarquivada.' : 'Conversa arquivada.')}>
              <Archive className="w-4 h-4 mr-2" /> {selectedConversation.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleFlag(setConversationMuted, 'muted', !selectedConversation.muted, selectedConversation.muted ? 'Notificações reativadas.' : 'Notificações silenciadas.')}>
              {selectedConversation.muted ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
              {selectedConversation.muted ? 'Reativar notificações' : 'Silenciar notificações'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleFlag(setConversationPinned, 'pinned', !selectedConversation.pinned, selectedConversation.pinned ? 'Conversa desafixada.' : 'Conversa fixada.')}>
              {selectedConversation.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
              {selectedConversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkUnread}>
              <MailQuestion className="w-4 h-4 mr-2" /> Marcar como não lida
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleFlag(setConversationFavorite, 'favorite', !selectedConversation.favorite, selectedConversation.favorite ? 'Removida dos favoritos.' : 'Adicionada aos favoritos.')}>
              <Star className="w-4 h-4 mr-2" /> {selectedConversation.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConfirmAction('block')} className={selectedConversation.blocked ? '' : 'text-destructive focus:text-destructive'}>
              <Ban className="w-4 h-4 mr-2" /> {selectedConversation.blocked ? 'Desbloquear número' : 'Bloquear'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmAction('clear')} className="text-destructive focus:text-destructive">
              <Eraser className="w-4 h-4 mr-2" /> Limpar conversa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmAction('delete')} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Apagar conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
