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
  sendManualImageMessage,
  toggleAutomationPause,
  markConversationRead,
  type SocialConversationRow,
  type SocialMessageRow,
} from '@/actions/social-inbox'
import { uploadFormAsset } from '@/actions/upload'

// Conjunto enxuto de emojis comuns para atendimento (sem libs externas) —
// mesmo padrão usado no WhatsappChat.tsx.
const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤗','🤔','😅','😉','🙂','😇','🥳','😏',
  '👍','👎','👏','🙏','💪','🤝','👋','✌️','🤙','👌','🫶','💯','🔥','✨','⭐','🎉',
  '❤️','🧡','💛','💚','💙','💜','🤍','💔','😢','😭','😅','😡','😱','🤯','🥺','😴',
  '✅','❌','⚠️','📌','📎','📷','🎁','💰','💳','🛫','🏨','🌴','🗺️','📅','⏰','📞',
]

function Avatar({ name, username, avatarUrl, size = 'md' }: { name: string | null; username: string | null; avatarUrl: string | null; size?: 'md' | 'lg' }) {
  const label = name || username || '?'
  const initials = label.slice(0, 2).toUpperCase()
  const dim = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={label} className={`${dim} rounded-full object-cover shrink-0`} />
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white flex items-center justify-center text-xs font-semibold shrink-0`}>
      {initials}
    </div>
  )
}

type Props = {
  orgSlug: string
  orgId?: string
  conversations: SocialConversationRow[]
  selectedConversation: SocialConversationRow | null
  initialMessages: SocialMessageRow[]
}

export default function SocialInbox({ orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages }: Props) {
  // Lista ao vivo — semeada pelo server, atualizada em tempo real abaixo.
  const [conversations, setConversations] = useState(conversationsProp)
  useEffect(() => { setConversations(conversationsProp) }, [conversationsProp])
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')
  const [pausing, setPausing] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Lista de conversas ao vivo — mesmo padrão do WhatsappChat: qualquer
  // mensagem toca social_conversations no servidor, então escutando essa
  // tabela a lista reordena e mostra não-lido sem F5. Conversa nova (sem
  // join de perfil disponível no payload) só dispara um refresh silencioso.
  useEffect(() => {
    if (!orgId) return
    const channel = supabase.channel(`social_conv_list_${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'social_conversations', filter: `organization_id=eq.${orgId}` }, (payload) => {
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === (payload.new as any).id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...(payload.new as any) }
          next.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
          return next
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_conversations', filter: `organization_id=eq.${orgId}` }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId, supabase, router])

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

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedConversation) return
    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)
    const uploaded = await uploadFormAsset(orgSlug, formData)
    if (!uploaded.ok) {
      toast.error('Não foi possível enviar a imagem', { description: uploaded.error })
      setUploadingImage(false)
      return
    }
    const res = await sendManualImageMessage(orgSlug, selectedConversation.id, uploaded.url)
    if (!res.ok) {
      toast.error('Não foi possível enviar a imagem', { description: res.error })
    } else {
      router.refresh()
    }
    setUploadingImage(false)
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
    <div className="flex w-full h-full border-t border-[#efefef] dark:border-[#262626]">
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
              onClick={() => router.push(`/app/${orgSlug}/social/inbox?id=${c.id}`)}
              className={`p-3 cursor-pointer hover:bg-[#fafafa] dark:hover:bg-[#121212] transition-colors flex gap-3 justify-between items-center ${selectedConversation?.id === c.id ? 'bg-[#efefef] dark:bg-[#1a1a1a]' : ''}`}
            >
              <Avatar name={c.sender_name} username={c.sender_username} avatarUrl={c.sender_avatar_url} size="lg" />
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
                  {c.last_message_direction === 'outbound' && c.last_message_preview && <span>Você: </span>}
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

      <div className={`flex-1 flex-col bg-white dark:bg-black ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
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
                    <div className={`max-w-[65%] rounded-[22px] px-4 py-2 ${isInbound ? 'bg-[#efefef] dark:bg-[#262626] text-black dark:text-white' : 'bg-[#3797f0] text-white'}`}>
                      {m.media_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.media_url} alt="" className="max-w-full rounded-2xl mb-1 max-h-64 object-cover" />
                      )}
                      {m.message_text && <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.message_text}</div>}
                      {m.buttons && m.buttons.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2">
                          {m.buttons.map((b, k) => (
                            b.type === 'link' ? (
                              <a key={k} href={b.value} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-center px-3 py-1.5 rounded-full border border-white/40 hover:bg-white/10 truncate">
                                {b.label}
                              </a>
                            ) : (
                              <span key={k}
                                className="text-xs text-center px-3 py-1.5 rounded-full border border-white/40 truncate">
                                {b.label}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                      <div className={`text-[10px] mt-1 text-right ${isInbound ? 'text-[#8e8e8e]' : 'text-white/70'}`}>
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {!isInbound && m.sent_by === 'agent' && m.sent_by_name && ` · ${m.sent_by_name}`}
                        {!isInbound && m.sent_by !== 'agent' && ` · ${m.sent_by === 'funnel' ? 'funil' : 'automação'}`}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            <form onSubmit={handleSend} className="p-4 bg-white dark:bg-black border-t border-[#efefef] dark:border-[#262626] flex gap-2 items-end shrink-0 relative">
              {/* Emojis */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmoji(v => !v)}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground ${showEmoji ? 'bg-muted text-primary' : ''}`}
                  title="Emojis"
                  aria-label="Emojis"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                {showEmoji && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                    <div className="absolute bottom-12 left-0 z-20 w-64 max-h-56 overflow-y-auto bg-white dark:bg-black border border-[#dbdbdb] dark:border-[#262626] rounded-2xl shadow-lg p-2 grid grid-cols-8 gap-0.5">
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
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground shrink-0"
                title="Inserir imagem"
                aria-label="Inserir imagem"
              >
                {uploadingImage ? '...' : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                )}
              </button>

              <Input
                className="flex-1 bg-white dark:bg-black border border-[#dbdbdb] dark:border-[#262626] rounded-full px-5 min-h-[44px] focus-visible:ring-0"
                placeholder="Mensagem..."
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !input.trim()} variant="ghost" className="rounded-full min-h-[44px] min-w-[44px] px-0 text-[#3797f0] hover:bg-[#efefef] dark:hover:bg-[#262626] disabled:opacity-40" title="Enviar">
                {sending ? '...' : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-black">
            <div className="text-center p-8 max-w-sm">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-black dark:border-white flex items-center justify-center">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2Z"/></svg>
              </div>
              <h3 className="font-normal text-xl mb-1">Suas mensagens</h3>
              <p className="text-[#8e8e8e] text-sm">Selecione uma conversa para atender manualmente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
