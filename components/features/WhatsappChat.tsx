'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { sendWhatsappMessage, markConversationAsRead, seedMockConversations, simulateInboundMessage, cancelScheduledMessage } from '@/actions/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import ConversationDetailPanel, { agentColor, memberInitials } from '@/components/features/ConversationDetailPanel'
import ScheduleMessageButton from '@/components/features/ScheduleMessageButton'
import { Clock, X } from 'lucide-react'

export default function WhatsappChat({ orgSlug, orgId, conversations, selectedConversation, initialMessages, members = [], panelContext, scheduled = [], templates = [], isMock }: any) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [showEmoji, setShowEmoji] = useState(false)
  // Busca + filtros do inbox
  const [query, setQuery] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  // Busca de palavras dentro da conversa aberta
  const [msgQuery, setMsgQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
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

  // Estágios disponíveis (derivados das conversas atuais).
  const stageOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of conversations) {
      const n = c.leads?.pipeline_stages?.name
      if (n) set.add(n)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [conversations])

  // Vendedores que aparecem como responsáveis em alguma conversa.
  const sellerOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const c of conversations) {
      const owner = c.assigned_to ?? c.leads?.assigned_to
      if (owner) ids.add(owner)
    }
    return Array.from(ids).map(id => ({ id, member: memberById[id] }))
  }, [conversations, memberById])

  const activeFilters = (filterSeller ? 1 : 0) + (filterStage ? 1 : 0)

  // Inbox filtrado por busca de texto + vendedor + estágio.
  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations.filter((c: any) => {
      if (q) {
        const hay = `${c.contact_name || ''} ${c.contact_phone || ''} ${c.last_message_preview || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filterSeller) {
        const owner = c.assigned_to ?? c.leads?.assigned_to ?? null
        if (filterSeller === '__none' ? !!owner : owner !== filterSeller) return false
      }
      if (filterStage) {
        if ((c.leads?.pipeline_stages?.name || '') !== filterStage) return false
      }
      return true
    })
  }, [conversations, query, filterSeller, filterStage])

  // Mensagens visíveis: filtradas pela busca dentro da conversa.
  const visibleMessages = useMemo(() => {
    const q = msgQuery.trim().toLowerCase()
    if (!q) return messages
    return messages.filter((m: any) => msgBody(m).toLowerCase().includes(q))
  }, [messages, msgQuery])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Stable client across renders so the realtime effect below doesn't re-subscribe on every render
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setMessages(initialMessages)
    setMsgQuery('')
    setShowSearch(false)
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

  async function handleCancelScheduled(id: string) {
    const res = await cancelScheduledMessage(orgSlug, id)
    if (!res.ok) {
      toast.error('Não foi possível cancelar', { description: res.error })
      return
    }
    toast.success('Agendamento cancelado.')
    router.refresh()
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
        {/* Busca + filtros do inbox */}
        <div className="px-3 py-2 border-b bg-background shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Pesquisar conversas..."
                className="h-9 pl-8 pr-7 text-sm rounded-full bg-muted/50"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`relative h-9 w-9 shrink-0 flex items-center justify-center rounded-full border hover:bg-muted ${showFilters || activeFilters ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}`}
              title="Filtros"
              aria-label="Filtros"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              {activeFilters > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeFilters}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <select
                value={filterSeller}
                onChange={e => setFilterSeller(e.target.value)}
                className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
                aria-label="Filtrar por vendedor"
              >
                <option value="">Todos os vendedores</option>
                <option value="__none">Sem responsável</option>
                {sellerOptions.map(({ id, member }) => (
                  <option key={id} value={id}>{member?.name || member?.email || 'Membro'}</option>
                ))}
              </select>
              <select
                value={filterStage}
                onChange={e => setFilterStage(e.target.value)}
                className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
                aria-label="Filtrar por estágio"
              >
                <option value="">Todos os estágios</option>
                {stageOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => { setFilterSeller(''); setFilterStage('') }}
                  className="col-span-2 text-[11px] text-muted-foreground hover:text-foreground text-left"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((c: any) => (
            <div key={c.id} onClick={() => router.push(`/app/${orgSlug}/conversas?id=${c.id}`)} className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors flex justify-between items-start ${selectedConversation?.id === c.id ? 'bg-muted/50' : ''}`}>
              <div className="overflow-hidden flex-1 pr-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-sm truncate">{c.contact_name || c.contact_phone}</span>
                  {c.leads?.pipeline_stages?.name && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 max-w-[90px]" title={`Etapa: ${c.leads.pipeline_stages.name}`}>
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                      <span className="truncate">{c.leads.pipeline_stages.name}</span>
                    </span>
                  )}
                </div>
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
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {conversations.length === 0
                ? 'Nenhuma conversa encontrada.'
                : 'Nenhuma conversa corresponde à busca ou aos filtros.'}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex-col bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/gi_DckOUM5a.png')] bg-repeat ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            <div className="px-4 md:px-6 py-3 border-b bg-background flex justify-between items-center gap-2 h-16 shrink-0   z-10">
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
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSearch(v => { if (v) setMsgQuery(''); return !v })}
                  className={`h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted ${showSearch ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                  title="Pesquisar nesta conversa"
                  aria-label="Pesquisar nesta conversa"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </button>
                {selectedConversation.contato_id && (
                  <Link href={`/app/${orgSlug}/contatos/${selectedConversation.contato_id}`} className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium hover:bg-primary/20 transition-colors">Abrir Lead</Link>
                )}
              </div>
            </div>

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

            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-white/60">
              {visibleMessages.map((m: any) => {
                const isInbound = m.direction === 'inbound'
                const body = msgBody(m) || '[Mídia recebida]'
                return (
                  <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-none px-4 py-2   relative ${isInbound ? 'bg-white border text-black rounded-tl-none' : 'bg-[#dcf8c6] text-black border border-[#dcf8c6] rounded-tr-none'}`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{highlightText(body, msgQuery)}</div>
                      <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 text-black/40`}>
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
                    <div className="absolute bottom-12 left-0 z-20 w-64 max-h-56 overflow-y-auto bg-background border rounded-none   p-2 grid grid-cols-8 gap-0.5">
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

              {/* Agendar envio */}
              <ScheduleMessageButton
                orgSlug={orgSlug}
                conversationId={selectedConversation.id}
                text={input}
                templates={templates}
                onScheduled={() => setInput('')}
              />

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
          <div className="flex-1 flex items-center justify-center bg-white/60">
            <div className="text-center p-8 bg-background/80 rounded-none   border max-w-sm">
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

// Extrai o texto de uma mensagem (cobre os dois formatos de content).
function msgBody(m: any): string {
  return m?.content?.text?.body || m?.content?.body || ''
}

// Destaca todas as ocorrências do termo de busca dentro de um texto.
function highlightText(text: string, q: string): React.ReactNode {
  const term = q.trim()
  if (!term) return text
  const lower = text.toLowerCase()
  const needle = term.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < text.length) {
    const idx = lower.indexOf(needle, i)
    if (idx === -1) { parts.push(text.slice(i)); break }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(<mark key={key++} className="bg-yellow-300/70 rounded-sm px-0.5 text-black">{text.slice(idx, idx + needle.length)}</mark>)
    i = idx + needle.length
  }
  return parts
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
