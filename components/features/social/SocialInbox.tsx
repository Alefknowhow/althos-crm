'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  sendManualMessage,
  toggleAutomationPause,
  markConversationRead,
  type SocialConversationRow,
  type SocialMessageRow,
} from '@/actions/social-inbox'

type Props = {
  orgSlug: string
  conversations: SocialConversationRow[]
  selectedConversation: SocialConversationRow | null
  initialMessages: SocialMessageRow[]
}

export default function SocialInbox({ orgSlug, conversations, selectedConversation, initialMessages }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')
  const [pausing, setPausing] = useState(false)
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => {
      const hay = `${c.sender_name || ''} ${c.sender_username || ''} ${c.last_message_preview || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [conversations, query])

  useEffect(() => {
    setMessages(initialMessages)
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markConversationRead(orgSlug, selectedConversation.id)
    }
  }, [initialMessages, selectedConversation, orgSlug])

  useEffect(() => {
    const conversationId = selectedConversation?.id
    if (!conversationId) return
    const channel = supabase
      .channel(`social_inbox_${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          setMessages(prev => [...prev, payload.new as SocialMessageRow])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
          markConversationRead(orgSlug, conversationId)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedConversation?.id, orgSlug, supabase])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !selectedConversation) return
    setSending(true)
    const text = input
    setInput('')
    const res = await sendManualMessage(orgSlug, selectedConversation.id, text)
    if (!res.ok) {
      toast.error('Não foi possível enviar a mensagem', { description: res.error })
      setInput(text)
    } else {
      router.refresh()
    }
    setSending(false)
  }

  async function handleTogglePause(paused: boolean) {
    if (!selectedConversation) return
    setPausing(true)
    const res = await toggleAutomationPause(orgSlug, selectedConversation.id, paused)
    if (!res.ok) toast.error('Não foi possível alterar', { description: res.error })
    else router.refresh()
    setPausing(false)
  }

  return (
    <div className="flex w-full h-full border-t">
      <div className={`w-full md:w-1/3 md:max-w-[350px] border-r flex-col bg-muted/10 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-3 py-2 border-b bg-background shrink-0">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar conversas..."
            className="h-9 text-sm rounded-full bg-muted/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(c => (
            <div
              key={c.id}
              onClick={() => router.push(`/app/${orgSlug}/social/inbox?id=${c.id}`)}
              className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors flex justify-between items-start ${selectedConversation?.id === c.id ? 'bg-muted/50' : ''}`}
            >
              <div className="overflow-hidden flex-1 pr-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-sm truncate">
                    {c.sender_name || (c.sender_username ? `@${c.sender_username}` : 'Instagram')}
                  </span>
                  {c.automation_paused && (
                    <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      manual
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {c.last_message_preview || '—'}
                </div>
              </div>
              {c.unread_count > 0 && (
                <Badge variant="destructive" className="h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px] shrink-0">
                  {c.unread_count}
                </Badge>
              )}
            </div>
          ))}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {conversations.length === 0
                ? 'Nenhuma conversa ainda. As DMs do Instagram aparecem aqui automaticamente.'
                : 'Nenhuma conversa corresponde à busca.'}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex-col bg-secondary/20 ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            <div className="px-4 md:px-6 py-3 border-b bg-background flex justify-between items-center gap-2 h-16 shrink-0   z-10">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => router.push(`/app/${orgSlug}/social/inbox`)}
                  className="md:hidden shrink-0 -ml-1 p-1 rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="Voltar para a lista"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="min-w-0">
                  <span className="font-semibold truncate block">
                    {selectedConversation.sender_name || (selectedConversation.sender_username ? `@${selectedConversation.sender_username}` : 'Instagram')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {selectedConversation.automation_paused ? 'Atendimento manual' : 'Automação ativa'}
                </span>
                <Switch
                  checked={!selectedConversation.automation_paused}
                  onCheckedChange={v => handleTogglePause(!v)}
                  disabled={pausing}
                  title={selectedConversation.automation_paused ? 'Devolver para o bot' : 'Pausar automação'}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map(m => {
                const isInbound = m.direction === 'inbound'
                return (
                  <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-none px-4 py-2   ${isInbound ? 'bg-background border rounded-tl-none' : 'bg-primary text-primary-foreground rounded-tr-none'}`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.message_text || '[sem texto]'}</div>
                      <div className={`text-[10px] mt-1 text-right ${isInbound ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {!isInbound && m.sent_by !== 'agent' && ` · ${m.sent_by === 'funnel' ? 'funil' : 'automação'}`}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            <form onSubmit={handleSend} className="p-4 bg-background border-t flex gap-2 items-end shrink-0">
              <Input
                className="flex-1 bg-muted/50 rounded-full px-5 min-h-[44px]"
                placeholder="Digite uma mensagem..."
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !input.trim()} className="rounded-full min-h-[44px] min-w-[44px] px-0" title="Enviar">
                {sending ? '...' : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 bg-background/80 rounded-none   border max-w-sm">
              <h3 className="font-semibold text-lg mb-2">Inbox do Instagram</h3>
              <p className="text-muted-foreground text-sm">Selecione uma conversa na barra lateral para atender manualmente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
