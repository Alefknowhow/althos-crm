import { useState, useEffect, useRef, useMemo } from 'react'
import {
  sendWhatsappMessage, markConversationAsRead, seedMockConversations, simulateInboundMessage, cancelScheduledMessage,
  markConversationAsUnread, clearConversationMessages, deleteConversation, blockWhatsappContact,
  setConversationAutomationPaused, suggestWhatsappReply,
} from '@/actions/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { msgBody } from './WhatsappChatWidgets'
import { useWhatsappChatMediaState } from './useWhatsappChatMediaState'
import { useWhatsappChatFiltersState } from './useWhatsappChatFiltersState'

// Estado + handlers do WhatsappChat, extraídos pra cá pra manter o componente
// principal focado em composição de JSX. Pura movimentação de código — sem
// mudança de comportamento.
export function useWhatsappChatState({
  orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages, members = [], pipelineStages = [],
}: any) {
  // Lista ao vivo — semeada pelo server, depois atualizada em tempo real
  // (ver efeito abaixo) pra não precisar de F5 quando chega mensagem nova.
  const [conversations, setConversations] = useState(conversationsProp)
  useEffect(() => { setConversations(conversationsProp) }, [conversationsProp])
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [simulating, setSimulating] = useState(false)
  const [suggestingReply, setSuggestingReply] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [showEmoji, setShowEmoji] = useState(false)
  const [draggingFile, setDraggingFile] = useState(false)
  // Ampliar imagem da conversa em popup, não em nova aba.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  // Busca de palavras dentro da conversa aberta
  const [msgQuery, setMsgQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  // Menu de opções da conversa (arquivar, silenciar, fixar, bloquear etc.)
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | 'block' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [pausingAi, setPausingAi] = useState(false)

  // Tick compartilhado pra recalcular a contagem regressiva da janela de
  // 24h grátis (API oficial) sem um setInterval por linha da lista.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
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

  const filters = useWhatsappChatFiltersState({ orgSlug, conversations, members, pipelineStages, selectedConversation })

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
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markConversationAsRead(orgSlug, selectedConversation.id)
    }
  }, [initialMessages, selectedConversation, orgSlug])

  // Rola pro fim (últimas mensagens) sempre que abre uma conversa — precisa
  // ser um efeito separado do de cima, disparado por `messages` (o estado
  // já renderizado), não por `initialMessages`: chamar scrollIntoView no
  // mesmo efeito que ainda vai setar o estado rola com base no layout
  // ANTERIOR (a lista antiga, ou vazia na primeira conversa aberta), o que
  // deixava a conversa abrindo no topo/mensagens antigas.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, selectedConversation?.id])

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

  // Lista de conversas ao vivo: qualquer mensagem (de qualquer conversa,
  // aberta ou não) toca whatsapp_conversations.last_message_at/preview/
  // unread_count no servidor — escutando essa tabela a lista reordena e
  // mostra o não-lido sem F5. Conversa nova (contato nunca visto) não tem
  // como montar a linha completa (falta o join com contatos) só com o
  // payload do realtime, então nesse caso só pedimos um refresh silencioso.
  useEffect(() => {
    if (!orgId) return
    const channel = supabase.channel(`wa_conv_list_${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations', filter: `organization_id=eq.${orgId}` }, (payload) => {
        setConversations((prev: any[]) => {
          const idx = prev.findIndex(c => c.id === payload.new.id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...payload.new }
          next.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
          return next
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations', filter: `organization_id=eq.${orgId}` }, () => {
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

    const res = await sendWhatsappMessage(orgSlug, selectedConversation.id, text)
    if (!res.ok) {
      toast.error('Não foi possível enviar a mensagem', { description: res.error })
      setInput(text) // restore so the user doesn't lose what they typed
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // "Sugestão de resposta" — a IA lê a conversa e só preenche a caixa de
  // texto; quem decide se envia (e pode editar antes) é o humano, igual
  // deixar um rascunho pronto. Não substitui o que já estava digitado sem
  // perguntar, pra não apagar algo que o atendente já tinha começado.
  async function handleSuggestReply() {
    if (!selectedConversation || suggestingReply) return
    if (input.trim()) {
      const overwrite = window.confirm('Já tem um texto na caixa de digitação. Substituir pela sugestão da IA?')
      if (!overwrite) return
    }
    setSuggestingReply(true)
    const res = await suggestWhatsappReply(orgSlug, selectedConversation.id)
    setSuggestingReply(false)
    if (!res.ok) {
      toast.error('Não foi possível gerar sugestão', { description: res.error })
      return
    }
    setInput(res.suggestion)
    inputRef.current?.focus()
  }

  // Enter envia; Shift+Enter quebra linha (igual WhatsApp normal).
  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  // A caixa de texto cresce junto com o conteúdo (até um teto), em vez de
  // rolar por dentro de uma linha só.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const media = useWhatsappChatMediaState({ orgSlug, selectedConversation })

  async function handleToggleFlag(
    action: (orgSlug: string, id: string, value: boolean) => Promise<{ ok: boolean; error?: string }>,
    field: 'archived' | 'muted' | 'pinned' | 'favorite',
    nextValue: boolean,
    successMsg: string,
  ) {
    if (!selectedConversation) return
    const res = await action(orgSlug, selectedConversation.id, nextValue)
    if (!res.ok) { toast.error(res.error || 'Não foi possível concluir a ação.'); return }
    setConversations((prev: any[]) => prev.map(c => c.id === selectedConversation.id ? { ...c, [field]: nextValue } : c))
    toast.success(successMsg)
    router.refresh()
  }

  async function handleToggleAi(nextEnabled: boolean) {
    if (!selectedConversation) return
    setPausingAi(true)
    const res = await setConversationAutomationPaused(orgSlug, selectedConversation.id, !nextEnabled)
    setPausingAi(false)
    if (!res.ok) { toast.error(res.error || 'Não foi possível alterar.'); return }
    setConversations((prev: any[]) => prev.map(c => c.id === selectedConversation.id ? { ...c, automation_paused: !nextEnabled } : c))
    toast.success(nextEnabled ? 'IA reativada nesta conversa.' : 'IA pausada — você está no controle.')
    router.refresh()
  }

  async function handleMarkUnread() {
    if (!selectedConversation) return
    const res = await markConversationAsUnread(orgSlug, selectedConversation.id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Marcada como não lida.')
    router.push(`/app/${orgSlug}/conversas`)
  }

  async function handleConfirmedAction() {
    if (!selectedConversation || !confirmAction) return
    setActionLoading(true)
    try {
      if (confirmAction === 'clear') {
        const res = await clearConversationMessages(orgSlug, selectedConversation.id)
        if (!res.ok) throw new Error(res.error)
        setMessages([])
        toast.success('Conversa limpa.')
      } else if (confirmAction === 'delete') {
        const res = await deleteConversation(orgSlug, selectedConversation.id)
        if (!res.ok) throw new Error(res.error)
        toast.success('Conversa apagada.')
        router.push(`/app/${orgSlug}/conversas`)
      } else if (confirmAction === 'block') {
        const willBlock = !selectedConversation.blocked
        const res = await blockWhatsappContact(orgSlug, selectedConversation.id, willBlock)
        if (!res.ok) throw new Error(res.error)
        setConversations((prev: any[]) => prev.map(c => c.id === selectedConversation.id ? { ...c, blocked: willBlock } : c))
        toast.success(willBlock ? 'Número bloqueado.' : 'Número desbloqueado.')
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível concluir a ação.')
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
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

  return {
    ...media,
    ...filters,
    conversations, setConversations, messages, setMessages, input, setInput, sending,
    inputRef, simulating, suggestingReply, seeding, panelOpen, setPanelOpen, showEmoji, setShowEmoji,
    draggingFile, setDraggingFile, lightboxUrl, setLightboxUrl,
    msgQuery, setMsgQuery, showSearch, setShowSearch, confirmAction, setConfirmAction, actionLoading,
    pausingAi, now, router, lastSeen,
    visibleMessages, messagesEndRef, handleSend, handleSuggestReply,
    handleComposerKeyDown,
    handleToggleFlag, handleToggleAi, handleMarkUnread, handleConfirmedAction, handleCancelScheduled,
    handleSeed, handleSimulateInbound,
  }
}
