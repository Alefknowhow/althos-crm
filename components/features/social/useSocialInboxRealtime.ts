import { useEffect } from 'react'
import { markConversationRead, type SocialConversationRow, type SocialMessageRow } from '@/actions/social-inbox'

// Assinaturas realtime (mensagens da conversa aberta + lista de conversas)
// do SocialInbox — extraído de SocialInbox.tsx pra manter o componente
// principal abaixo do limite de linhas. Pura movimentação de código.
export function useSocialInboxRealtime({
  supabase, orgId, orgSlug, selectedConversation, messagesEndRef, setMessages, setConversations,
}: any) {
  useEffect(() => {
    const conversationId = selectedConversation?.id
    if (!conversationId) return
    const channel = supabase
      .channel(`social_inbox_${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
          setMessages((prev: SocialMessageRow[]) => [...prev, payload.new as SocialMessageRow])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
          markConversationRead(orgSlug, conversationId)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'social_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
          setMessages((prev: SocialMessageRow[]) => prev.map(m => m.id === (payload.new as any).id ? (payload.new as SocialMessageRow) : m))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedConversation?.id, orgSlug, supabase, setMessages, messagesEndRef])

  // Lista de conversas ao vivo — mesmo padrão do WhatsappChat: qualquer
  // mensagem toca social_conversations no servidor, então escutando essa
  // tabela a lista reordena e mostra não-lido sem F5. Conversa nova entra
  // direto no estado a partir do próprio payload (a linha já vem completa,
  // sem join pendente) — nada de router.refresh() aqui, que é uma
  // ida-e-volta ao servidor e quebra a expectativa de "tempo real".
  useEffect(() => {
    if (!orgId) return
    const channel = supabase.channel(`social_conv_list_${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'social_conversations', filter: `organization_id=eq.${orgId}` }, (payload: any) => {
        setConversations((prev: SocialConversationRow[]) => {
          const idx = prev.findIndex(c => c.id === (payload.new as any).id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...(payload.new as any) }
          next.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
          return next
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_conversations', filter: `organization_id=eq.${orgId}` }, (payload: any) => {
        setConversations((prev: SocialConversationRow[]) => {
          if (prev.some(c => c.id === (payload.new as any).id)) return prev
          const next = [payload.new as SocialConversationRow, ...prev]
          next.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
          return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId, supabase, setConversations])
}
