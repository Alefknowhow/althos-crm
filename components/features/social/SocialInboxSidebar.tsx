import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pin } from 'lucide-react'
import type { SocialConversationRow } from '@/actions/social-inbox'
import { Avatar, ConversationTicks, formatInboxTime } from './SocialInboxHelpers'

/**
 * Conversation list sidebar of SocialInbox. Split out of SocialInbox.tsx —
 * purely presentational, selection is delegated via onSelect.
 */
export function SocialInboxSidebar({
  filteredConversations, totalCount, selectedConversation, query, setQuery, onSelect,
}: {
  filteredConversations: SocialConversationRow[]
  totalCount: number
  selectedConversation: SocialConversationRow | null
  query: string
  setQuery: (v: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <div className={`w-full md:w-1/3 md:max-w-[350px] border-r border-[#efefef] dark:border-[#262626] flex-col bg-white dark:bg-black ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
      <div className="px-3 py-2 border-b border-[#efefef] dark:border-[#262626] shrink-0">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Pesquisar"
          className="h-9 text-sm rounded-xl bg-[#efefef] dark:bg-[#262626] border-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map(c => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`p-3 cursor-pointer hover:bg-[#fafafa] dark:hover:bg-[#121212] transition-colors flex gap-3 justify-between items-center ${selectedConversation?.id === c.id ? 'bg-[#efefef] dark:bg-[#1a1a1a]' : ''}`}
          >
            <Avatar name={c.sender_name} username={c.sender_username} avatarUrl={c.sender_avatar_url} size="lg" />
            <div className="overflow-hidden flex-1 pr-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-sm truncate">
                  {c.sender_name || (c.sender_username ? `@${c.sender_username}` : 'Instagram')}
                </span>
                {c.pinned && <Pin className="w-3 h-3 shrink-0 text-muted-foreground" />}
                {c.automation_paused && (
                  <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    manual
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {c.last_message_direction === 'outbound' && c.last_message_preview && <span>Você: </span>}
                {c.last_message_preview || '—'}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="flex items-center gap-1">
                {c.last_message_direction === 'outbound' && <ConversationTicks status={c.last_message_status} />}
                <span className={`text-[10px] font-medium ${c.unread_count > 0 ? 'text-[#3797f0]' : 'text-muted-foreground'}`}>{formatInboxTime(c.last_message_at)}</span>
              </span>
              {c.unread_count > 0 && (
                <Badge variant="destructive" className="h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px] shrink-0">
                  {c.unread_count}
                </Badge>
              )}
            </div>
          </div>
        ))}
        {filteredConversations.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {totalCount === 0
              ? 'Nenhuma conversa ainda. As DMs do Instagram aparecem aqui automaticamente.'
              : 'Nenhuma conversa corresponde à busca.'}
          </div>
        )}
      </div>
    </div>
  )
}
