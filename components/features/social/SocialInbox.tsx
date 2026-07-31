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

function Avatar({ name, username, avatarUrl }: { name: string | null; username: string | null; avatarUrl: string | null }) {
  const label = name || username || '?'
  const initials = label.slice(0, 2).toUpperCase()
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={label} className="h-9 w-9 rounded-full object-cover shrink-0" />
  }
  return (
    <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
      {initials}
    </div>
  )
}

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
              className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors flex gap-3 justify-between items-start ${selectedConversation?.id === c.id ? 'bg-muted/50' : ''}`}
            >
              <Avatar name={c.sender_name} username={c.sender_username} avatarUrl={c.sender_avatar_url} />
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
                <Avatar name={selectedConversation.sender_name} username={selectedConversation.sender_username} avatarUrl={selectedConversation.sender_avatar_url} />
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
                      {m.media_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.media_url} alt="" className="max-w-full rounded-none mb-1 max-h-64 object-cover" />
                      )}
                      {m.message_text && <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.message_text}</div>}
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

            <form onSubmit={handleSend} className="p-4 bg-background border-t flex gap-2 items-end shrink-0 relative">
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
                    <div className="absolute bottom-12 left-0 z-20 w-64 max-h-56 overflow-y-auto bg-background border rounded-none p-2 grid grid-cols-8 gap-0.5">
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
