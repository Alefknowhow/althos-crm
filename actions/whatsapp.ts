'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { sendTextMessage } from '@/lib/whatsapp/meta-client'

export async function saveWhatsappConfig(orgSlug: string, phone_id: string, token: string) {
  if (isImpersonating()) {
    return { ok: false, error: 'Alteração de credenciais críticas não permitida em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { error } = await supabase.from('organizations').update({
    whatsapp_phone_number_id: phone_id,
    whatsapp_access_token: token
  }).eq('id', org.id)
  
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/whatsapp`)
  return { ok: true }
}

export async function testWhatsappConnection(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  if (!org.whatsapp_phone_number_id || !org.whatsapp_access_token) return { ok: false, error: 'Credenciais não configuradas' }
  if (org.whatsapp_access_token === 'mock') return { ok: true }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${org.whatsapp_phone_number_id}`, {
      headers: { 'Authorization': `Bearer ${org.whatsapp_access_token}` }
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function sendWhatsappMessage(orgSlug: string, conversationId: string, content: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('id', conversationId).eq('organization_id', org.id).maybeSingle()
  if (!conv) return { ok: false, error: 'Conversa não encontrada' }

  const { data: msg, error: insertError } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    organization_id: org.id,
    direction: 'outbound',
    type: 'text',
    content: { body: content },
    status: 'sending'
  }).select().single()

  if (insertError) return { ok: false, error: insertError.message }

  try {
    const metaRes = await sendTextMessage(org, conv.contact_phone, content)
    
    await supabase.from('whatsapp_messages').update({
      meta_message_id: metaRes.messages[0].id,
      status: 'sent'
    }).eq('id', msg.id)
    
    if (conv.lead_id) {
       await supabase.from('lead_activities').insert({
          lead_id: conv.lead_id,
          organization_id: org.id,
          type: 'whatsapp_sent',
          payload: { body: content }
       })
    }

    revalidatePath(`/app/${orgSlug}/conversas`)
    return { ok: true, message: msg }
  } catch (e: any) {
    await supabase.from('whatsapp_messages').update({
      status: 'failed',
      content: { body: content, error: e.message }
    }).eq('id', msg.id)
    return { ok: false, error: e.message }
  }
}

export async function markConversationAsRead(orgSlug: string, conversationId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conversationId).eq('organization_id', org.id)
  revalidatePath(`/app/${orgSlug}/conversas`)
}
