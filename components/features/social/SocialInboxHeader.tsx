import { Switch } from '@/components/ui/switch'
import { MoreVertical, Archive, BellOff, Bell, Pin, PinOff, Star, MailQuestion, Eraser, Trash2, Ban } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar } from './SocialInboxHelpers'
import {
  setSocialConversationArchived,
  setSocialConversationMuted,
  setSocialConversationPinned,
  setSocialConversationFavorite,
} from '@/actions/social-inbox'

// Cabeçalho da conversa aberta (avatar, nome, toggle de automação, menu de
// opções) — extraído de SocialInbox.tsx. Pura movimentação de JSX.
export function SocialInboxHeader({
  orgSlug, router, selectedConversation, pausing, handleTogglePause, handleToggleFlag, handleMarkUnread, setConfirmAction,
}: any) {
  return (
    <div className="px-4 md:px-6 py-3 border-b border-[#efefef] dark:border-[#262626] bg-white dark:bg-black flex justify-between items-center gap-2 h-[72px] shrink-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => router.push(`/app/${orgSlug}/social/inbox`)}
          className="md:hidden shrink-0 -ml-1 p-1 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Voltar para a lista"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <Avatar name={selectedConversation.sender_name} username={selectedConversation.sender_username} avatarUrl={selectedConversation.sender_avatar_url} />
        <div className="min-w-0">
          <span className="font-semibold text-sm truncate block">
            {selectedConversation.sender_name || (selectedConversation.sender_username ? `@${selectedConversation.sender_username}` : 'Instagram')}
          </span>
          {selectedConversation.sender_username && selectedConversation.sender_name && (
            <span className="text-xs text-[#8e8e8e] truncate block">@{selectedConversation.sender_username}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {selectedConversation.automation_paused ? 'Atendimento manual' : 'Automação ativa'}
        </span>
        <Switch
          checked={!selectedConversation.automation_paused}
          onCheckedChange={(v: boolean) => handleTogglePause(!v)}
          disabled={pausing}
          title={selectedConversation.automation_paused ? 'Devolver para o bot' : 'Pausar automação'}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
              title="Mais opções"
              aria-label="Mais opções"
            >
              <MoreVertical className="w-[18px] h-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationArchived, 'archived', !selectedConversation.archived, selectedConversation.archived ? 'Conversa desarquivada.' : 'Conversa arquivada.')}>
              <Archive className="w-4 h-4 mr-2" /> {selectedConversation.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationMuted, 'muted', !selectedConversation.muted, selectedConversation.muted ? 'Notificações reativadas.' : 'Notificações silenciadas.')}>
              {selectedConversation.muted ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
              {selectedConversation.muted ? 'Reativar notificações' : 'Silenciar notificações'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationPinned, 'pinned', !selectedConversation.pinned, selectedConversation.pinned ? 'Conversa desafixada.' : 'Conversa fixada.')}>
              {selectedConversation.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
              {selectedConversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkUnread}>
              <MailQuestion className="w-4 h-4 mr-2" /> Marcar como não lida
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationFavorite, 'favorite', !selectedConversation.favorite, selectedConversation.favorite ? 'Removida dos favoritos.' : 'Adicionada aos favoritos.')}>
              <Star className="w-4 h-4 mr-2" /> {selectedConversation.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConfirmAction('block')} className={selectedConversation.blocked ? '' : 'text-destructive focus:text-destructive'}>
              <Ban className="w-4 h-4 mr-2" /> {selectedConversation.blocked ? 'Desbloquear contato' : 'Bloquear'}
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
