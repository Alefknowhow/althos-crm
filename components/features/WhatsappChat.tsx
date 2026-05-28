'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { sendWhatsappMessage, markConversationAsRead } from '@/actions/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

export default function WhatsappChat({ orgSlug, orgId, conversations, selectedConversation, initialMessages }: any) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Stable client across renders so the realtime effect below doesn't re-subscribe on every render
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setMessages(initialMessages)
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markConversationAsRead(orgSlug, selectedConversation.id)
    }
  }, [initialMessages, selectedConversation, orgSlug])

  useEffect(() => {
    const conversationId = selectedConversation?.id
    if (!conversationId) return
    const channel = supabase.channel(`chat_${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev:any) => [...prev, payload.new])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        markConversationAsRead(orgSlug, conversationId)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev:any) => prev.map((m:any) => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedConversation?.id, orgSlug, supabase])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !selectedConversation) return
    
    setSending(true)
    const text = input
    setInput('')
    
    const res = await sendWhatsappMessage(orgSlug, selectedConversation.id, text)
    if (!res.ok) {
      toast.error('Não foi possível enviar a mensagem', { description: res.error })
      setInput(text) // restore so the user doesn't lose what they typed
    }
    setSending(false)
  }

  return (
    <div className="flex w-full h-full border-t">
      <div className="w-1/3 max-w-[350px] border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b bg-background font-semibold shrink-0 h-16 flex items-center">
          Inbox WhatsApp
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c: any) => (
            <div key={c.id} onClick={() => router.push(`/app/${orgSlug}/conversas?id=${c.id}`)} className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors flex justify-between items-start ${selectedConversation?.id === c.id ? 'bg-muted/50' : ''}`}>
              <div className="overflow-hidden flex-1 pr-2">
                <div className="font-medium text-sm truncate">{c.contact_name || c.contact_phone}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{c.contact_phone}</div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground font-medium">{new Date(c.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                {c.unread_count > 0 && <Badge variant="destructive" className="h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px]">{c.unread_count}</Badge>}
              </div>
            </div>
          ))}
          {conversations.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma conversa encontrada.</div>}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/gi_DckOUM5a.png')] bg-repeat">
        {selectedConversation ? (
          <>
            <div className="px-6 py-3 border-b bg-background flex justify-between items-center h-16 shrink-0 shadow-sm z-10">
              <div>
                <div className="font-semibold">{selectedConversation.contact_name || selectedConversation.contact_phone}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{selectedConversation.contact_phone}</div>
              </div>
              {selectedConversation.lead_id && (
                <Link href={`/app/${orgSlug}/leads/${selectedConversation.lead_id}`} className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium hover:bg-primary/20 transition-colors">Abrir Lead</Link>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-white/60 backdrop-blur-[2px]">
              {messages.map((m: any) => {
                const isInbound = m.direction === 'inbound'
                return (
                  <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm relative ${isInbound ? 'bg-white border text-black rounded-tl-none' : 'bg-[#dcf8c6] text-black border border-[#dcf8c6] rounded-tr-none'}`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content?.text?.body || m.content?.body || '[Mídia recebida]'}</div>
                      <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 text-black/40`}>
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {!isInbound && <span className="ml-0.5 font-medium uppercase text-[8px] tracking-wider">{m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : m.status === 'sent' ? '✓' : m.status}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            <form onSubmit={handleSend} className="p-4 bg-background border-t flex gap-3 items-end shrink-0 z-10">
              <Input className="flex-1 bg-muted/50 rounded-full px-5 min-h-[44px]" placeholder="Digite uma mensagem..." value={input} onChange={e => setInput(e.target.value)} disabled={sending} />
              <Button type="submit" disabled={sending || !input.trim()} className="rounded-full px-6 min-h-[44px]">{sending ? '...' : 'Enviar'}</Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <div className="text-center p-8 bg-background/80 rounded-2xl shadow-sm border max-w-sm">
               <h3 className="font-semibold text-lg mb-2">WhatsApp Web</h3>
               <p className="text-muted-foreground text-sm">Selecione uma conversa na barra lateral para iniciar o atendimento ao cliente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
