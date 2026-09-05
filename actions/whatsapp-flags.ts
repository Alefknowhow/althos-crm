'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

// ─── Estados de conversa (arquivar, silenciar, fixar, favoritar, bloquear) ──

type ConversationFlag = 'archived' | 'muted' | 'pinned' | 'favorite' | 'automation_paused'

async function toggleConversationFlag(orgSlug: string, conversationId: string, field: ConversationFlag, value: boolean) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({ [field]: value })
    .eq('id', conversationId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const }
}

export const setConversationArchived = async (orgSlug: string, id: string, value: boolean) => toggleConversationFlag(orgSlug, id, 'archived', value)
export const setConversationMuted    = async (orgSlug: string, id: string, value: boolean) => toggleConversationFlag(orgSlug, id, 'muted', value)
export const setConversationPinned   = async (orgSlug: string, id: string, value: boolean) => toggleConversationFlag(orgSlug, id, 'pinned', value)
export const setConversationFavorite = async (orgSlug: string, id: string, value: boolean) => toggleConversationFlag(orgSlug, id, 'favorite', value)
/** Liga/desliga o Agente IA só nesta conversa (a IA continua ativa nas
 * demais). Usado pelo toggle no cabeçalho do chat e, automaticamente,
 * sempre que o atendente manda uma mensagem manual. */
export const setConversationAutomationPaused = async (orgSlug: string, id: string, value: boolean) => toggleConversationFlag(orgSlug, id, 'automation_paused', value)

export async function markConversationAsUnread(orgSlug: string, conversationId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({ unread_count: 1 })
    .eq('id', conversationId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const }
}

/** Apaga só as mensagens, mantendo a conversa (equivalente a "Limpar
 * conversa" do WhatsApp Business App). */
export async function clearConversationMessages(orgSlug: string, conversationId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ação não permitida em modo de impersonação.' }
  }
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada' }

  const { error } = await supabase.from('whatsapp_messages').delete().eq('conversation_id', conversationId)
  if (error) return { ok: false as const, error: error.message }

  await supabase
    .from('whatsapp_conversations')
    .update({ last_message_preview: null, last_message_direction: null, unread_count: 0 })
    .eq('id', conversationId)

  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const }
}

/** Apaga a conversa inteira (mensagens somem em cascata pela FK). */
export async function deleteConversation(orgSlug: string, conversationId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ação não permitida em modo de impersonação.' }
  }
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const }
}

/** Bloqueia o número na API oficial do WhatsApp (POST
 * /{phone_number_id}/block_users) — impede que ele mande novas mensagens
 * pro seu número. Diferente das outras flags, essa é real, não só local. */
export async function blockWhatsappContact(orgSlug: string, conversationId: string, block: boolean) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ação não permitida em modo de impersonação.' }
  }
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, contact_phone')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada' }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('whatsapp_phone_number_id, whatsapp_access_token')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.whatsapp_phone_number_id || !orgRow?.whatsapp_access_token || orgRow.whatsapp_access_token === 'mock') {
    return { ok: false as const, error: 'WhatsApp não conectado.' }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v26.0/${orgRow.whatsapp_phone_number_id}/block_users`, {
      method: block ? 'POST' : 'DELETE',
      headers: {
        Authorization: `Bearer ${orgRow.whatsapp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        block_users: [{ user: conv.contact_phone }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || 'Falha ao bloquear número na Meta.')
    }
  } catch (e: any) {
    return { ok: false as const, error: e.message || 'Erro ao comunicar com a Meta.' }
  }

  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({ blocked: block })
    .eq('id', conversationId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const }
}
