'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { sendInstagramDM } from '@/lib/social/instagram'
import { logOutboundMessage } from '@/lib/social/conversation-log'

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
  contato_id: string | null
  last_message_at: string | null
  last_message_preview: string | null
  last_message_direction: 'inbound' | 'outbound' | null
  unread_count: number
  automation_paused: boolean
}

export type SocialMessageRow = {
  id: string
  direction: 'inbound' | 'outbound'
  message_text: string | null
  sent_by: 'user' | 'automation' | 'funnel' | 'agent'
  created_at: string
}

async function guard(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'social')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, org }
}

export async function listConversations(orgSlug: string): Promise<SocialConversationRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('social_conversations')
    .select('id, sender_external_id, sender_username, sender_name, contato_id, last_message_at, last_message_preview, last_message_direction, unread_count, automation_paused')
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
    .select('id, direction, message_text, sent_by, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  return (data as SocialMessageRow[] | null) || []
}

/** A Meta só permite enviar DM até 24h após a última mensagem inbound (sem a
 *  tag HUMAN_AGENT, que exige aprovação separada — ver docs/instagram-meta-setup.md). */
function withinMessagingWindow(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false
  return Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000
}

export async function sendManualMessage(orgSlug: string, conversationId: string, text: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const body = text.trim()
  if (!body) return { ok: false as const, error: 'Mensagem vazia' }

  const supabase = createClient()
  const { data: conv } = await supabase
    .from('social_conversations')
    .select('id, sender_external_id, social_connection_id, last_message_at, last_message_direction')
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada' }

  const { data: connection } = await supabase
    .from('social_connections')
    .select('page_id, access_token')
    .eq('id', conv.social_connection_id)
    .maybeSingle()
  if (!connection?.access_token) return { ok: false as const, error: 'Conexão do Instagram não encontrada' }

  const lastInbound = conv.last_message_direction === 'inbound' ? conv.last_message_at : null
  if (!withinMessagingWindow(lastInbound)) {
    return {
      ok: false as const,
      error: 'Fora da janela de 24h da Meta — só é possível responder até 24h após a última mensagem do cliente.',
    }
  }

  try {
    await sendInstagramDM(connection.page_id, connection.access_token, conv.sender_external_id, body)
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao enviar mensagem no Instagram' }
  }

  await logOutboundMessage(supabase as any, conv.id, g.org.id, body, 'agent')
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
