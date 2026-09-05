'use client'

import { Input } from '@/components/ui/input'
import { Clock, X } from 'lucide-react'
import { LinkPreviewCard, linkifyText } from '@/components/features/LinkPreviewCard'
import { extractFirstUrl } from '@/lib/link-preview/extract-url'
import { msgBody, renderWhatsappMedia, highlightText, MessageTicks } from './WhatsappChatWidgets'

export default function WhatsappChatMessagesPane({
  showSearch, msgQuery, setMsgQuery, setShowSearch, visibleMessages,
  orgSlug, setLightboxUrl, messagesEndRef, scheduled, handleCancelScheduled,
}: any) {
  return (
    <>
      {showSearch && (
        <div className="px-4 md:px-6 py-2 border-b bg-background flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <Input
              autoFocus
              value={msgQuery}
              onChange={e => setMsgQuery(e.target.value)}
              placeholder="Pesquisar palavras nesta conversa..."
              className="h-9 pl-8 text-sm rounded-full bg-muted/50"
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {msgQuery.trim() ? `${visibleMessages.length} resultado${visibleMessages.length === 1 ? '' : 's'}` : ''}
          </span>
          <button
            type="button"
            onClick={() => { setShowSearch(false); setMsgQuery('') }}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground shrink-0"
            aria-label="Fechar busca"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3">
        {visibleMessages.map((m: any) => {
          const isInbound = m.direction === 'inbound'
          const media = renderWhatsappMedia(m, orgSlug, setLightboxUrl)
          const text = msgBody(m)
          const linkUrl = !media && text && !msgQuery.trim() ? extractFirstUrl(text) : null
          return (
            <div key={m.id} className={`flex min-w-0 ${isInbound ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] min-w-0 rounded-[7px] px-2.5 py-1.5 relative shadow-sm ${
                  isInbound
                    ? 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-[2px]'
                    : 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-[2px]'
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {media || (text ? (linkUrl ? linkifyText(text) : highlightText(text, msgQuery)) : '[Mídia recebida]')}
                </div>
                {linkUrl && <LinkPreviewCard url={linkUrl} />}
                <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 text-[#667781] dark:text-[#8696a0]`}>
                  {!isInbound && m.sent_by_name && <span className="truncate max-w-[120px]">{m.sent_by_name} ·</span>}
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {!isInbound && <MessageTicks status={m.status} />}
                </div>
              </div>
            </div>
          )
        })}
        {msgQuery.trim() && visibleMessages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem com “{msgQuery.trim()}”.</div>
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {scheduled.length > 0 && (
        <div className="px-4 pt-2 bg-background border-t shrink-0 space-y-1">
          {scheduled.map((s: any) => (
            <div key={s.id} className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium shrink-0">
                {new Date(s.send_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="truncate flex-1 text-amber-800">{s.body}</span>
              <button
                type="button"
                onClick={() => handleCancelScheduled(s.id)}
                className="shrink-0 hover:text-red-600"
                title="Cancelar agendamento"
                aria-label="Cancelar agendamento"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
