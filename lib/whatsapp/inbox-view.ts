export type InboxView = 'all' | 'unread' | 'pinned' | 'archived'

export function matchesInboxView(conversation: { id: string; archived?: boolean | null; pinned?: boolean | null; unread_count?: number | null }, view: InboxView, selectedId?: string): boolean {
  if (view === 'archived') return !!conversation.archived
  // Mantém a conversa aberta visível ao arquivar ou marcar como lida.
  if (conversation.id === selectedId) return true
  if (conversation.archived) return false
  if (view === 'unread') return (conversation.unread_count ?? 0) > 0
  if (view === 'pinned') return !!conversation.pinned
  return true
}
