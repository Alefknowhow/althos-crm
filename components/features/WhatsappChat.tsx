'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { sendWhatsappMessage, markConversationAsRead, seedMockConversations, simulateInboundMessage } from '@/actions/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import ConversationDetailPanel, { agentColor, memberInitials } from '@/components/features/ConversationDetailPanel'

export default function WhatsappChat({ orgSlug, orgId, conversations, selectedConversation, initialMessages, members = [], panelContext, isMock }: any) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [showEmoji, setShowEmoji] = useState(false)
  const router = useRouter()

  // "Visto por último": derivado da última mensagem recebida do contato.
  // Em modo mock não há presença real, então usamos o último inbound como proxy.
  const lastSeen = useMemo(() => {
    const inbound = [...messages].reverse().find((m: any) => m.direction === 'inbound')
    if (!inbound) return null
    const d = new Date(inbound.created_at)
    const today = new Date()
    const sameDay = d.toDateString() === today.toDateString()
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return sameDay ? `visto por último hoje às ${time}` : `visto por último ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`
  }, [messages])

  // Etapa do funil do lead vinculado (para a tag compacta no cabeçalho).
  const stageName: string | null = panelContext?.lead?.pipeline_stages?.name ?? null

  const memberById = useMemo(() => {
    const map: Record<string, any> = {}
    for (const m of members) map[m.user_id] = m
    return map
  }, [members])
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

  async function handleSeed() {
    setSeeding(true)
    const res = await seedMockConversations(orgSlug)
    if (res.ok) {
      toast.success(`${res.created} conversas de teste criadas.`)
      router.refresh()
    } else {
      toast.error('Não foi possível gerar as conversas', { description: res.error })
    }
    setSeeding(false)
  }

  async function handleSimulateInbound() {
    if (!selectedConversation) return
    setSimulating(true)
    const text = input.trim() || 'Mensagem de teste do cliente 👋'
    if (input.trim()) setInput('')
    const res = await simulateInboundMessage(orgSlug, selectedConversation.id, text)
    if (!res.ok) {
      toast.error('Não foi possível simular a resposta', { description: res.error })
    }
    setSimulating(false)
  }

  return (
    <div className="flex w-full h-full border-t">
      <div className={`w-full md:w-1/3 md:max-w-[350px] border-r flex-col bg-muted/10 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b bg-background font-semibold shrink-0 h-16 flex items-center justify-between gap-2">
          <span>Inbox WhatsApp</span>
          {isMock && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSeed}
              disabled={seeding}
              className="text-xs h-7"
              title="Modo de teste — gera conversas fictícias (WhatsApp não conectado)"
            >
              {seeding ? '...' : '🧪 Gerar conversas'}
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c: any) => (
            <div key={c.id} onClick={() => router.push(`/app/${orgSlug}/conversas?id=${c.id}`)} className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors flex justify-between items-start ${selectedConversation?.id === c.id ? 'bg-muted/50' : ''}`}>
              <div className="overflow-hidden flex-1 pr-2">
                <div className="font-medium text-sm truncate">{c.contact_name || c.contact_phone}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                  {c.last_message_direction === 'outbound' && (
                    <svg width="15" height="10" viewBox="0 0 18 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/70"><path d="M1 5.5 4.5 9 11 1.5"/><path d="M6 5.5 9.5 9 16 1.5"/></svg>
                  )}
                  <span className="truncate">{c.last_message_preview || c.contact_phone}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-[10px] font-medium ${c.unread_count > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{formatInboxTime(c.last_message_at)}</span>
                <div className="flex items-center gap-1.5">
                  {c.unread_count > 0 && <Badge variant="destructive" className="h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px]">{c.unread_count}</Badge>}
                  {(() => {
                    // Híbrido: responsável do atendimento, com fallback no dono do lead.
                    const ownerId = c.assigned_to ?? c.leads?.assigned_to ?? null
                    if (!ownerId) return null
                    const m = memberById[ownerId]
                    return (
                      <div
                        className={`h-5 w-5 rounded-full ${agentColor(ownerId)} text-white text-[9px] font-semibold flex items-center justify-center`}
                        title={`Atendendo: ${m?.name || m?.email || 'membro'}`}
                      >
                        {memberInitials(m?.name, m?.email)}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          ))}
          {conversations.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma conversa encontrada.</div>}
        </div>
      </div>

      <div className={`flex-1 flex-col bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/gi_DckOUM5a.png')] bg-repeat ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            <div className="px-4 md:px-6 py-3 border-b bg-background flex justify-between items-center gap-2 h-16 shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-2 min-w-0">
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
                    <span className="font-semibold truncate">{selectedConversation.contact_name || selectedConversation.contact_phone}</span>
                    {stageName && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {stageName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{lastSeen || selectedConversation.contact_phone}</div>
                </div>
              </div>
              {selectedConversation.lead_id && (
                <Link href={`/app/${orgSlug}/leads/${selectedConversation.lead_id}`} className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium hover:bg-primary/20 transition-colors shrink-0">Abrir Lead</Link>
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
                        {!isInbound && <MessageTicks status={m.status} />}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            <form onSubmit={handleSend} className="p-4 bg-background border-t flex gap-2 items-end shrink-0 z-10 relative">
              {isMock && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSimulateInbound}
                  disabled={simulating}
                  className="rounded-full min-h-[44px] px-3 text-muted-foreground shrink-0"
                  title="Modo de teste — insere uma mensagem como se o cliente tivesse respondido"
                >
                  {simulating ? '...' : '🧪'}
                </Button>
              )}

              {/* Emojis */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmoji(v => !v)}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground ${showEmoji ? 'bg-muted text-primary' : ''}`}
                  title="Emojis e figurinhas"
                  aria-label="Emojis e figurinhas"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                {showEmoji && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                    <div className="absolute bottom-12 left-0 z-20 w-64 max-h-56 overflow-y-auto bg-background border rounded-xl shadow-lg p-2 grid grid-cols-8 gap-0.5">
                      {EMOJIS.map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => { setInput(prev => prev + e); setShowEmoji(false) }}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-lg leading-none"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Imagem / anexo */}
              <button
                type="button"
                onClick={() => toast.info('Envio de imagens', { description: 'Disponível ao conectar a API oficial do WhatsApp.' })}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground shrink-0"
                title="Inserir imagem"
                aria-label="Inserir imagem"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              </button>

              <Input className="flex-1 bg-muted/50 rounded-full px-5 min-h-[44px]" placeholder="Digite uma mensagem..." value={input} onChange={e => setInput(e.target.value)} disabled={sending} />

              {input.trim() ? (
                <Button type="submit" disabled={sending} className="rounded-full min-h-[44px] min-w-[44px] px-0 flex items-center justify-center" title="Enviar">
                  {sending ? '...' : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  )}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => toast.info('Gravação de áudio', { description: 'Disponível ao conectar a API oficial do WhatsApp.' })}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 shrink-0"
                  title="Gravar áudio"
                  aria-label="Gravar áudio"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
              )}
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

      {selectedConversation && (
        <ConversationDetailPanel
          orgSlug={orgSlug}
          conversation={selectedConversation}
          context={panelContext}
          members={members}
          open={panelOpen}
          onToggle={() => setPanelOpen(o => !o)}
        />
      )}
    </div>
  )
}

// Marcadores de status estilo WhatsApp:
//  • relógio  → pendente/enviando
//  • 1 tique cinza → enviado (sent)
//  • 2 tiques cinza → entregue (delivered)
//  • 2 tiques azuis → lido (read)
//  • triângulo vermelho → falha
function MessageTicks({ status }: { status?: string }) {
  if (status === 'failed') {
    return <span title="Falha no envio" className="text-red-500 text-[11px] leading-none">⚠</span>
  }
  if (!status || status === 'pending' || status === 'sending') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black/40" aria-label="Enviando">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" />
      </svg>
    )
  }
  const isRead = status === 'read'
  const isDouble = status === 'delivered' || status === 'read'
  const cls = isRead ? 'text-sky-500' : 'text-black/40'
  const label = isRead ? 'Lida' : isDouble ? 'Entregue' : 'Enviada'
  return (
    <svg
      width={isDouble ? 18 : 13}
      height="11"
      viewBox={isDouble ? '0 0 18 11' : '0 0 12 11'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-label={label}
    >
      <path d="M1 5.5 4.5 9 11 1.5" />
      {isDouble && <path d="M6 5.5 9.5 9 16 1.5" />}
    </svg>
  )
}

// Horário do inbox no estilo WhatsApp: hoje → HH:MM, ontem → "Ontem",
// últimos 7 dias → dia da semana, mais antigo → DD/MM/AAAA.
function formatInboxTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days <= 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Ontem'
  if (days < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Conjunto enxuto de emojis comuns para atendimento (sem libs externas).
const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤗','🤔','😅','😉','🙂','😇','🥳','😏',
  '👍','👎','👏','🙏','💪','🤝','👋','✌️','🤙','👌','🫶','💯','🔥','✨','⭐','🎉',
  '❤️','🧡','💛','💚','💙','💜','🤍','💔','😢','😭','😅','😡','😱','🤯','🥺','😴',
  '✅','❌','⚠️','📌','📎','📷','🎁','💰','💳','🛫','🏨','🌴','🗺️','📅','⏰','📞',
]
