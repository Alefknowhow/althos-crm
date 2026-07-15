/**
 * Histórico de mensagens do inbox de DM do Instagram (social_conversations +
 * social_messages). Usado pelo engine/funnel-engine para registrar toda troca
 * (automação, funil ou atendente) e pelas actions do inbox manual para ler o
 * mesmo histórico.
 */

import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

export type ConversationRef = { id: string; automationPaused: boolean }

/** Busca (ou cria) a conversa do remetente nesta conexão, sem tocar em
 *  automation_paused/unread_count/last_message_* de uma conversa existente. */
export async function getOrCreateConversation(
  admin: Admin,
  params: {
    organizationId: string
    connectionId: string
    senderId: string
    senderUsername?: string | null
    senderName?: string | null
  },
): Promise<ConversationRef> {
  const { data, error } = await admin
    .from('social_conversations')
    .upsert(
      {
        organization_id: params.organizationId,
        social_connection_id: params.connectionId,
        sender_external_id: params.senderId,
        sender_username: params.senderUsername ?? null,
        sender_name: params.senderName ?? null,
      },
      { onConflict: 'social_connection_id,sender_external_id' },
    )
    .select('id, automation_paused')
    .single()
  if (error || !data) throw new Error(error?.message || 'failed to upsert social_conversations')
  return { id: data.id, automationPaused: !!data.automation_paused }
}

async function touchConversation(
  admin: Admin,
  conversationId: string,
  preview: string,
  direction: 'inbound' | 'outbound',
  incrementUnread: boolean,
) {
  const patch: Record<string, unknown> = {
    last_message_at: new Date().toISOString(),
    last_message_preview: preview.slice(0, 200),
    last_message_direction: direction,
  }
  if (incrementUnread) {
    const { data } = await admin
      .from('social_conversations')
      .select('unread_count')
      .eq('id', conversationId)
      .maybeSingle()
    patch.unread_count = (data?.unread_count ?? 0) + 1
  }
  await admin.from('social_conversations').update(patch).eq('id', conversationId)
}

export async function logInboundMessage(
  admin: Admin,
  conversationId: string,
  organizationId: string,
  text: string,
) {
  await admin.from('social_messages').insert({
    conversation_id: conversationId,
    organization_id: organizationId,
    direction: 'inbound',
    message_text: text,
    sent_by: 'user',
  })
  await touchConversation(admin, conversationId, text, 'inbound', true)
}

export async function logOutboundMessage(
  admin: Admin,
  conversationId: string,
  organizationId: string,
  text: string,
  sentBy: 'automation' | 'funnel' | 'agent',
) {
  await admin.from('social_messages').insert({
    conversation_id: conversationId,
    organization_id: organizationId,
    direction: 'outbound',
    message_text: text,
    sent_by: sentBy,
  })
  await touchConversation(admin, conversationId, text, 'outbound', false)
}
