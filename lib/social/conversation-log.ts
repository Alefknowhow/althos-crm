/**
 * Histórico de mensagens do inbox de DM do Instagram (social_conversations +
 * social_messages). Usado pelo engine/funnel-engine para registrar toda troca
 * (automação, funil ou atendente) e pelas actions do inbox manual para ler o
 * mesmo histórico.
 */

import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

export type ConversationRef = { id: string; automationPaused: boolean; needsProfileEnrichment: boolean }

/** Busca (ou cria) a conversa do remetente nesta conexão, sem tocar em
 *  automation_paused/unread_count/last_message_* de uma conversa existente.
 *
 *  NÃO busca perfil na API aqui de propósito — isso é uma chamada de rede à
 *  parte (ver `enrichConversationProfile`), e o objetivo deste passo é
 *  gravar a conversa o mais rápido possível pra a mensagem aparecer no
 *  inbox quase instantaneamente. `needsProfileEnrichment` avisa o chamador
 *  se vale a pena buscar nome/foto depois (só quando a conversa ainda não
 *  tinha nome salvo). */
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
  const { data: existing } = await admin
    .from('social_conversations')
    .select('id, automation_paused, sender_username, sender_name, sender_avatar_url')
    .eq('social_connection_id', params.connectionId)
    .eq('sender_external_id', params.senderId)
    .maybeSingle()

  const senderUsername = params.senderUsername ?? existing?.sender_username ?? null
  const senderName = params.senderName ?? existing?.sender_name ?? null

  const { data, error } = await admin
    .from('social_conversations')
    .upsert(
      {
        organization_id: params.organizationId,
        social_connection_id: params.connectionId,
        sender_external_id: params.senderId,
        sender_username: senderUsername,
        sender_name: senderName,
      },
      { onConflict: 'social_connection_id,sender_external_id' },
    )
    .select('id, automation_paused')
    .single()
  if (error || !data) throw new Error(error?.message || 'failed to upsert social_conversations')
  return { id: data.id, automationPaused: !!data.automation_paused, needsProfileEnrichment: !existing?.sender_name }
}

/** Segundo passo, separado de propósito: busca nome/username/foto na API do
 *  Instagram e atualiza a conversa. Roda DEPOIS da mensagem já ter sido
 *  gravada (ver processInboundInteraction) — assim a latência de rede dessa
 *  chamada não atrasa a mensagem aparecendo no inbox; só o nome/foto chegam
 *  um instante depois, via realtime UPDATE. Best-effort. */
export async function enrichConversationProfile(
  admin: Admin,
  conversationId: string,
  fetchProfile: () => Promise<{ name: string | null; username: string | null; avatarUrl: string | null } | null>,
): Promise<void> {
  try {
    const profile = await fetchProfile()
    if (!profile) return
    const patch: Record<string, string> = {}
    if (profile.name) patch.sender_name = profile.name
    if (profile.username) patch.sender_username = profile.username
    if (profile.avatarUrl) patch.sender_avatar_url = profile.avatarUrl
    if (Object.keys(patch).length === 0) return
    await admin.from('social_conversations').update(patch).eq('id', conversationId)
  } catch (e: any) {
    console.error('[social] enrichConversationProfile failed:', e?.message)
  }
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
  mediaUrl?: string | null,
  mediaType?: 'image' | 'audio' | 'video' | 'document' | null,
) {
  await admin.from('social_messages').insert({
    conversation_id: conversationId,
    organization_id: organizationId,
    direction: 'inbound',
    message_text: text || null,
    media_url: mediaUrl ?? null,
    media_type: mediaType ?? null,
    sent_by: 'user',
  })
  const preview = mediaUrl
    ? (mediaType === 'audio' ? '🎤 Áudio' : mediaType === 'video' ? '🎬 Vídeo' : '📷 Foto')
    : text
  await touchConversation(admin, conversationId, preview, 'inbound', true)
}

export async function logOutboundMessage(
  admin: Admin,
  conversationId: string,
  organizationId: string,
  text: string,
  sentBy: 'automation' | 'funnel' | 'agent',
  mediaUrl?: string | null,
  sentByName?: string | null,
  buttons?: { type: 'reply' | 'link'; label: string; value: string }[] | null,
  mediaType?: 'image' | 'audio' | 'video' | 'document' | null,
  metaMessageId?: string | null,
) {
  await admin.from('social_messages').insert({
    conversation_id: conversationId,
    organization_id: organizationId,
    direction: 'outbound',
    message_text: text || null,
    media_url: mediaUrl ?? null,
    media_type: mediaUrl ? (mediaType ?? 'image') : null,
    meta_message_id: metaMessageId ?? null,
    status: 'sent',
    sent_by: sentBy,
    sent_by_name: sentByName ?? null,
    buttons: buttons?.length ? buttons : null,
  })
  const preview = mediaUrl
    ? (mediaType === 'audio' ? '🎤 Áudio' : mediaType === 'video' ? '🎬 Vídeo' : '📷 Foto')
    : text
  await touchConversation(admin, conversationId, preview, 'outbound', false)
  await admin.from('social_conversations').update({ last_message_status: 'sent' }).eq('id', conversationId)
}
