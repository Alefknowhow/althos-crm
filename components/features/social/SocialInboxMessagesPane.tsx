import { ConversationTicks, renderInstagramMedia } from './SocialInboxHelpers'
import type { SocialMessageRow } from '@/actions/social-inbox'

// Lista de mensagens da conversa aberta — extraído de SocialInbox.tsx. Pura
// movimentação de JSX.
export function SocialInboxMessagesPane({
  messages, setLightboxUrl, messagesEndRef,
}: {
  messages: SocialMessageRow[]
  setLightboxUrl: (url: string | null) => void
  messagesEndRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-3">
      {messages.map(m => {
        const isInbound = m.direction === 'inbound'
        const media = renderInstagramMedia(m, setLightboxUrl)
        return (
          <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[65%] rounded-[22px] px-4 py-2 text-foreground ${isInbound ? 'bg-card' : 'bg-primary/10'}`}>
              {media}
              {m.message_text && <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.message_text}</div>}
              {m.buttons && m.buttons.length > 0 && (
                <div className="flex flex-col gap-1 mt-2">
                  {m.buttons.map((b, k) => (
                    b.type === 'link' ? (
                      <a key={k} href={b.value} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-center px-3 py-1.5 rounded-full border border-foreground/20 hover:bg-foreground/10 truncate">
                        {b.label}
                      </a>
                    ) : (
                      <span key={k}
                        className="text-xs text-center px-3 py-1.5 rounded-full border border-foreground/20 truncate">
                        {b.label}
                      </span>
                    )
                  ))}
                </div>
              )}
              <div className="text-[10px] mt-1 text-right flex items-center justify-end gap-1 text-muted-foreground">
                {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {!isInbound && m.sent_by === 'agent' && m.sent_by_name && ` · ${m.sent_by_name}`}
                {!isInbound && m.sent_by !== 'agent' && ` · ${m.sent_by === 'funnel' ? 'funil' : 'automação'}`}
                {!isInbound && <ConversationTicks status={m.status} />}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={messagesEndRef} className="h-1" />
    </div>
  )
}
