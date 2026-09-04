'use server'

/**
 * Instagram inbox: conversation/message listing, read/unread, automation
 * pause toggle, and conversation flags (archive/mute/pin/favorite/block).
 * Split out of actions/social-inbox.ts.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { guard, type SocialConversationRow, type SocialMessageRow } from './social-inbox-send'

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
