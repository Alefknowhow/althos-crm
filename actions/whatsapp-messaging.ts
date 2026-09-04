'use server'

/**
 * Sending WhatsApp text/media messages and marking a conversation read.
 * Split out of actions/whatsapp.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { sendTextMessage, sendMediaMessage } from '@/lib/whatsapp/meta-client'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { getProfilesMap } from '@/lib/profiles'
import { uploadFile, getObjectSignedUrl } from '@/actions/storage'

const WHATSAPP_UPGRADE_ERROR = 'WhatsApp não está incluído no seu plano atual. Faça upgrade para o Pro ou Business para usar este recurso.'

export async function sendWhatsappMessage(orgSlug: string, conversationId: string, content: string) {
  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'whatsapp'))) {
    return { ok: false, error: WHATSAPP_UPGRADE_ERROR }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('id', conversationId).eq('organization_id', org.id).maybeSingle()
  if (!conv) return { ok: false, error: 'Conversa não encontrada' }

  const agentName = (await getProfilesMap([user.id])).get(user.id)?.full_name || null

  const { data: msg, error: insertError } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    organization_id: org.id,
    direction: 'outbound',
    type: 'text',
    content: { body: content },
    status: 'sending',
    sent_by_name: agentName,
  }).select().single()

  if (insertError) return { ok: false, error: insertError.message }

  // Atualiza a prévia/horário no inbox (modelo WhatsApp Business). Também
  // corrige o reordenamento: antes o envio não bumpava last_message_at.
  await supabase.from('whatsapp_conversations').update({
    last_message_at:        new Date().toISOString(),
    last_message_preview:   content,
    last_message_direction: 'outbound',
    last_message_status:    'sending',
    // Atendente respondeu na mão — a IA para de responder essa conversa até
    // alguém devolver o controle pelo toggle (mesmo padrão do Instagram).
    automation_paused:      true,
  }).eq('id', conv.id).eq('organization_id', org.id)

  try {
    const metaRes = await sendTextMessage(org, conv.contact_phone, content)

    await supabase.from('whatsapp_messages').update({
      meta_message_id: metaRes.messages[0].id,
      status: 'sent'
    }).eq('id', msg.id)
    await supabase.from('whatsapp_conversations').update({ last_message_status: 'sent' }).eq('id', conv.id)

    if (conv.contato_id) {
       await supabase.from('contato_activities').insert({
          contato_id: conv.contato_id,
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
    await supabase.from('whatsapp_conversations').update({ last_message_status: 'failed' }).eq('id', conv.id)
    return { ok: false, error: e.message }
  }
}

const MEDIA_KIND_BY_MIME: Record<string, 'image' | 'audio' | 'video' | 'document'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
  'audio/webm': 'audio', 'audio/ogg': 'audio', 'audio/mp4': 'audio', 'audio/mpeg': 'audio', 'audio/aac': 'audio', 'audio/opus': 'audio',
  'video/mp4': 'video', 'video/3gpp': 'video',
  'application/pdf': 'document',
}

/** Envia uma imagem ou áudio (inclusive gravado na hora) numa conversa —
 * sobe pro Storage público (mesmo bucket usado pra mídia recebida) e manda
 * pra Meta por link. */
export async function sendWhatsappMedia(orgSlug: string, conversationId: string, formData: FormData) {
  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'whatsapp'))) {
    return { ok: false, error: WHATSAPP_UPGRADE_ERROR }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const file = formData.get('file') as File | null
  const caption = (formData.get('caption') as string | null) || undefined
  if (!file) return { ok: false, error: 'Arquivo ausente.' }

  const baseMime = file.type.split(';')[0].trim() // MediaRecorder pode incluir ";codecs=opus" etc.
  const kind = MEDIA_KIND_BY_MIME[baseMime]
  if (!kind) return { ok: false, error: `Tipo de arquivo não suportado: ${file.type}` }
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: 'Arquivo muito grande (máx 20MB).' }

  const { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('id', conversationId).eq('organization_id', org.id).maybeSingle()
  if (!conv) return { ok: false, error: 'Conversa não encontrada' }

  // Sobe pro R2 via Storage Service — signed URL (não mais pública
  // permanente), assinada já na hora do upload e embutida na mensagem:
  // mensagens novas chegam no client via Realtime, sem passar pelo
  // servidor, então a URL precisa estar pronta pra uso imediato.
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const uploaded = await uploadFile(orgSlug, {
    category: 'whatsapp',
    scopeId: conv.id,
    conversationId: conv.id,
    filename: file.name,
    contentType: baseMime,
    base64,
  })
  if (!uploaded.ok) return { ok: false, error: uploaded.error }
  const signed = await getObjectSignedUrl(orgSlug, uploaded.objectId)
  if (!signed.ok) return { ok: false, error: signed.error }
  const publicUrl = signed.url

  const agentName = (await getProfilesMap([user.id])).get(user.id)?.full_name || null

  const { data: msg, error: insertError } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    organization_id: org.id,
    direction: 'outbound',
    type: kind,
    content: { media_url: publicUrl, media_object_id: uploaded.objectId, [kind]: caption ? { caption } : {} },
    status: 'sending',
    sent_by_name: agentName,
  }).select().single()
  if (insertError) return { ok: false, error: insertError.message }

  const previewLabel = kind === 'image' ? '📷 Foto' : kind === 'audio' ? '🎤 Áudio' : kind === 'video' ? '🎬 Vídeo' : '📄 Documento'
  await supabase.from('whatsapp_conversations').update({
    last_message_at:        new Date().toISOString(),
    last_message_preview:   previewLabel,
    last_message_direction: 'outbound',
    last_message_status:    'sending',
    automation_paused:      true,
  }).eq('id', conv.id).eq('organization_id', org.id)

  try {
    const metaRes = await sendMediaMessage(org, conv.contact_phone, kind, publicUrl, caption, file.name)
    await supabase.from('whatsapp_messages').update({
      meta_message_id: metaRes.messages[0].id,
      status: 'sent',
    }).eq('id', msg.id)
    await supabase.from('whatsapp_conversations').update({ last_message_status: 'sent' }).eq('id', conv.id)

    revalidatePath(`/app/${orgSlug}/conversas`)
    return { ok: true, message: msg }
  } catch (e: any) {
    await supabase.from('whatsapp_messages').update({ status: 'failed' }).eq('id', msg.id)
    await supabase.from('whatsapp_conversations').update({ last_message_status: 'failed' }).eq('id', conv.id)
    return { ok: false, error: e.message }
  }
}

export async function markConversationAsRead(orgSlug: string, conversationId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conversationId).eq('organization_id', org.id)
  revalidatePath(`/app/${orgSlug}/conversas`)
}
