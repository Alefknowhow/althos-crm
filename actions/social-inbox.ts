'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { sendInstagramDM, sendInstagramImage, sendInstagramAudio } from '@/lib/social/instagram'
import { logOutboundMessage } from '@/lib/social/conversation-log'
import { getProfilesMap } from '@/lib/profiles'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'

/**
 * Inbox manual de DM do Instagram: lista/lê conversas registradas por
 * lib/social/conversation-log e permite ao atendente responder à mão. Ao
 * responder manualmente, a conversa fica com automation_paused=true — o
 * motor de automação (lib/social/engine.ts) para de responder até o
 * atendente devolver o controle pelo toggle.
 */

export type SocialConversationRow = {
  id: string
  sender_external_id: string
  sender_username: string | null
  sender_name: string | null
  sender_avatar_url: string | null
  contato_id: string | null
  last_message_at: string | null
  last_message_preview: string | null
  last_message_direction: 'inbound' | 'outbound' | null
  last_message_status: string | null
  unread_count: number
  automation_paused: boolean
  archived: boolean
  muted: boolean
  pinned: boolean
  favorite: boolean
  blocked: boolean
}

export type SocialMessageRow = {
  id: string
  direction: 'inbound' | 'outbound'
  message_text: string | null
  media_url: string | null
  media_type: string | null
  status: string | null
  sent_by: 'user' | 'automation' | 'funnel' | 'agent'
  sent_by_name: string | null
  buttons: { type: 'reply' | 'link'; label: string; value: string }[] | null
  created_at: string
}

async function guard(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'social')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'instagram_automation'))) {
    return { ok: false as const, error: 'Instagram não está incluído no seu plano atual. Faça upgrade para o Pro ou Business para usar este recurso.' }
  }
  return { ok: true as const, org, user }
}

export async function listConversations(orgSlug: string): Promise<SocialConversationRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('social_conversations')
    .select('id, sender_external_id, sender_username, sender_name, sender_avatar_url, contato_id, last_message_at, last_message_preview, last_message_direction, last_message_status, unread_count, automation_paused, archived, muted, pinned, favorite, blocked')
    .eq('organization_id', org.id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  return (data as SocialConversationRow[] | null) || []
}

export async function getConversationMessages(
  orgSlug: string,
  conversationId: string,
): Promise<SocialMessageRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data: conv } = await supabase
    .from('social_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conv) return []
  const { data } = await supabase
    .from('social_messages')
    .select('id, direction, message_text, media_url, media_type, status, sent_by, sent_by_name, buttons, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  return (data as SocialMessageRow[] | null) || []
}

const HOUR = 60 * 60 * 1000
const STANDARD_WINDOW_MS = 24 * HOUR
const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR

/** A tag HUMAN_AGENT estende o envio de 24h pra 7 dias, mas exige aprovação
 *  específica da Meta no App Review (caso de uso "atendimento humano", não
 *  marketing) — fica desligada até a env confirmar que já foi aprovada. Ver
 *  docs/instagram-meta-setup.md. */
function humanAgentTagApproved(): boolean {
  return process.env.INSTAGRAM_HUMAN_AGENT_APPROVED === 'true'
}

type WindowCheck =
  | { ok: true; tag?: 'HUMAN_AGENT' }
  | { ok: false; error: string }

/** Decide se dá pra enviar agora, e com qual tag (a partir da última mensagem
 *  INBOUND de verdade, não da última mensagem da conversa — que pode já ser
 *  uma resposta nossa). */
function checkMessagingWindow(lastInboundAt: string | null): WindowCheck {
  if (!lastInboundAt) {
    return { ok: false, error: 'Fora da janela de mensagens da Meta — ainda não há mensagem do cliente nessa conversa.' }
  }
  const elapsed = Date.now() - new Date(lastInboundAt).getTime()
  if (elapsed < STANDARD_WINDOW_MS) return { ok: true }
  if (elapsed < HUMAN_AGENT_WINDOW_MS && humanAgentTagApproved()) return { ok: true, tag: 'HUMAN_AGENT' }
  return {
    ok: false,
    error: humanAgentTagApproved()
      ? 'Fora da janela de 7 dias da Meta — não é mais possível responder essa conversa.'
      : 'Fora da janela de 24h da Meta — só é possível responder até 24h após a última mensagem do cliente.',
  }
}

/** Busca a conversa + conexão e valida a janela de envio. Compartilhado por
 *  texto e imagem. */
async function loadConversationForSend(orgId: string, conversationId: string) {
  const supabase = createClient()
  const { data: conv } = await supabase
    .from('social_conversations')
    .select('id, sender_external_id, social_connection_id, blocked')
    .eq('id', conversationId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada' }
  if (conv.blocked) return { ok: false as const, error: 'Esse contato está bloqueado. Desbloqueie pra poder enviar mensagens.' }

  const { data: connection } = await supabase
    .from('social_connections')
    .select('page_id, access_token')
    .eq('id', conv.social_connection_id)
    .maybeSingle()
  if (!connection?.access_token) return { ok: false as const, error: 'Conexão do Instagram não encontrada' }

  const { data: lastInboundMsg } = await supabase
    .from('social_messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const windowCheck = checkMessagingWindow(lastInboundMsg?.created_at ?? null)
  if (!windowCheck.ok) return { ok: false as const, error: windowCheck.error }

  return { ok: true as const, supabase, conv, connection, tag: windowCheck.tag }
}

export async function sendManualMessage(orgSlug: string, conversationId: string, text: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const body = text.trim()
  if (!body) return { ok: false as const, error: 'Mensagem vazia' }

  const loaded = await loadConversationForSend(g.org.id, conversationId)
  if (!loaded.ok) return loaded
  const { supabase, conv, connection, tag } = loaded

  let messageId: string | undefined
  try {
    const res = await sendInstagramDM(connection.page_id, connection.access_token, conv.sender_external_id, body, undefined, tag)
    messageId = res.messageId
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao enviar mensagem no Instagram' }
  }

  const agentName = (await getProfilesMap([g.user.id])).get(g.user.id)?.full_name || null
  await logOutboundMessage(supabase as any, conv.id, g.org.id, body, 'agent', null, agentName, undefined, undefined, messageId)
  await supabase.from('social_conversations').update({ automation_paused: true }).eq('id', conv.id)

  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

/** Legenda vira uma mensagem de texto separada logo em seguida — a API de
 *  mensagens do Instagram não tem um campo de legenda embutida na imagem
 *  como a do WhatsApp. */
export async function sendManualImageMessage(orgSlug: string, conversationId: string, imageUrl: string, caption?: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  if (!imageUrl) return { ok: false as const, error: 'Imagem inválida' }

  const loaded = await loadConversationForSend(g.org.id, conversationId)
  if (!loaded.ok) return loaded
  const { supabase, conv, connection, tag } = loaded

  let messageId: string | undefined
  try {
    const res = await sendInstagramImage(connection.access_token, conv.sender_external_id, imageUrl, tag)
    messageId = res.messageId
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao enviar imagem no Instagram' }
  }

  const agentName = (await getProfilesMap([g.user.id])).get(g.user.id)?.full_name || null
  await logOutboundMessage(supabase as any, conv.id, g.org.id, '', 'agent', imageUrl, agentName, undefined, 'image', messageId)
  await supabase.from('social_conversations').update({ automation_paused: true }).eq('id', conv.id)

  if (caption?.trim()) {
    try {
      const res2 = await sendInstagramDM(connection.page_id, connection.access_token, conv.sender_external_id, caption.trim(), undefined, tag)
      await logOutboundMessage(supabase as any, conv.id, g.org.id, caption.trim(), 'agent', null, agentName, undefined, undefined, res2.messageId)
    } catch {
      // A imagem já foi enviada — não falha a operação toda se só a legenda der erro.
    }
  }

  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

export async function sendManualAudioMessage(orgSlug: string, conversationId: string, audioUrl: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  if (!audioUrl) return { ok: false as const, error: 'Áudio inválido' }

  const loaded = await loadConversationForSend(g.org.id, conversationId)
  if (!loaded.ok) return loaded
  const { supabase, conv, connection, tag } = loaded

  let messageId: string | undefined
  try {
    const res = await sendInstagramAudio(connection.access_token, conv.sender_external_id, audioUrl, tag)
    messageId = res.messageId
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao enviar áudio no Instagram' }
  }

  const agentName = (await getProfilesMap([g.user.id])).get(g.user.id)?.full_name || null
  await logOutboundMessage(supabase as any, conv.id, g.org.id, '', 'agent', audioUrl, agentName, undefined, 'audio', messageId)
  await supabase.from('social_conversations').update({ automation_paused: true }).eq('id', conv.id)

  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

export async function toggleAutomationPause(orgSlug: string, conversationId: string, paused: boolean) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  const { error } = await supabase
    .from('social_conversations')
    .update({ automation_paused: paused })
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

export async function markConversationRead(orgSlug: string, conversationId: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  await supabase
    .from('social_conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

// ─── Estados de conversa (arquivar, silenciar, fixar, favoritar, bloquear) ──

type SocialConversationFlag = 'archived' | 'muted' | 'pinned' | 'favorite' | 'blocked'

async function toggleSocialFlag(orgSlug: string, conversationId: string, field: SocialConversationFlag, value: boolean) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  const { error } = await supabase
    .from('social_conversations')
    .update({ [field]: value })
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

export const setSocialConversationArchived = (orgSlug: string, id: string, value: boolean) => toggleSocialFlag(orgSlug, id, 'archived', value)
export const setSocialConversationMuted    = (orgSlug: string, id: string, value: boolean) => toggleSocialFlag(orgSlug, id, 'muted', value)
export const setSocialConversationPinned   = (orgSlug: string, id: string, value: boolean) => toggleSocialFlag(orgSlug, id, 'pinned', value)
export const setSocialConversationFavorite = (orgSlug: string, id: string, value: boolean) => toggleSocialFlag(orgSlug, id, 'favorite', value)

export async function markSocialConversationAsUnread(orgSlug: string, conversationId: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  const { error } = await supabase
    .from('social_conversations')
    .update({ unread_count: 1 })
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

/** Apaga só as mensagens, mantendo a conversa. */
export async function clearSocialConversationMessages(orgSlug: string, conversationId: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()

  const { data: conv } = await supabase
    .from('social_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada' }

  const { error } = await supabase.from('social_messages').delete().eq('conversation_id', conversationId)
  if (error) return { ok: false as const, error: error.message }

  await supabase
    .from('social_conversations')
    .update({ last_message_preview: null, last_message_direction: null, unread_count: 0 })
    .eq('id', conversationId)

  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

/** Apaga a conversa inteira (mensagens somem em cascata pela FK). */
export async function deleteSocialConversation(orgSlug: string, conversationId: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  const { error } = await supabase
    .from('social_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

/** Bloqueio LOCAL apenas — a API de mensagens do Instagram não tem um
 *  endpoint de bloqueio de usuário como a do WhatsApp. Isso só impede o CRM
 *  de mandar mensagem (checa a flag antes de enviar), não bloqueia de
 *  verdade do lado da Meta. */
export async function setSocialConversationBlocked(orgSlug: string, conversationId: string, blocked: boolean) {
  return toggleSocialFlag(orgSlug, conversationId, 'blocked', blocked)
}
