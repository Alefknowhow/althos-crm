'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { sendInstagramDM, sendInstagramImage, sendInstagramAudio } from '@/lib/social/instagram'
import { logOutboundMessage } from '@/lib/social/conversation-log'
import { getProfilesMap } from '@/lib/profiles'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { uploadFile, getObjectSignedUrl } from '@/actions/storage'

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

const SOCIAL_MEDIA_KIND_BY_MIME: Record<string, 'image' | 'audio'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
  'audio/ogg': 'audio', 'audio/mpeg': 'audio', 'audio/mp4': 'audio', 'audio/aac': 'audio',
}

/** Sobe uma imagem ou áudio (inclusive gravado na hora) pro bucket público
 * instagram-media — a API de mensagens do Instagram baixa a mídia de uma URL
 * pública, então precisa estar acessível antes de mandar pra Meta. */
export async function uploadSocialMedia(orgSlug: string, formData: FormData) {
  const g = await guard(orgSlug)
  if (!g.ok) return g

  const file = formData.get('file') as File | null
  if (!file) return { ok: false as const, error: 'Arquivo não enviado' }

  const baseMime = file.type.split(';')[0]
  const kind = SOCIAL_MEDIA_KIND_BY_MIME[baseMime]
  if (!kind) return { ok: false as const, error: `Tipo de arquivo não suportado: ${file.type}` }
  if (file.size > 20 * 1024 * 1024) return { ok: false as const, error: 'Arquivo muito grande (máx 20MB).' }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const uploaded = await uploadFile(orgSlug, {
    category: 'instagram',
    filename: file.name,
    contentType: baseMime,
    base64,
  })
  if (!uploaded.ok) return { ok: false as const, error: uploaded.error }
  const signed = await getObjectSignedUrl(orgSlug, uploaded.objectId)
  if (!signed.ok) return { ok: false as const, error: signed.error }

  return { ok: true as const, url: signed.url, kind }
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

/* ──────────────────────────────────────────────────────────────────────────
 * PAINEL DE DETALHES DO LEAD (Instagram) — equivalente ao que
 * actions/whatsapp.ts::getConversationContext/createLeadFromConversation
 * fazem para o WhatsApp. Alimenta components/features/social/
 * SocialLeadDetailPanel.tsx.
 * ──────────────────────────────────────────────────────────────────────── */

/** Contexto do painel: a conversa, o lead vinculado (se houver) e os
 *  estágios do pipeline padrão pro seletor de etapa. */
export async function getSocialConversationContext(orgSlug: string, conversationId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conversation } = await supabase
    .from('social_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()

  let lead: any = null
  if (conversation?.contato_id) {
    const { data } = await supabase
      .from('contatos')
      .select('*, pipeline_stages(id, name)')
      .eq('id', conversation.contato_id)
      .eq('organization_id', org.id)
      .maybeSingle()
    lead = data
  }

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', org.id)
    .eq('is_default', true)
    .maybeSingle()

  let stages: { id: string; name: string; is_won: boolean; is_lost: boolean }[] = []
  if (pipeline) {
    const { data: st } = await supabase
      .from('pipeline_stages')
      .select('id, name, position, is_won, is_lost')
      .eq('pipeline_id', pipeline.id)
      .order('position', { ascending: true })
    stages = (st ?? []).map(s => ({ id: s.id, name: s.name, is_won: !!s.is_won, is_lost: !!s.is_lost }))
  }

  return { conversation, lead, stages }
}

/** "Criar lead a partir do contato" pro Instagram — mesmo conceito de
 *  actions/whatsapp.ts::createLeadFromConversation, mas copiando a foto de
 *  perfil do Instagram (já vem resolvida em social_conversations.sender_
 *  avatar_url, ver lib/social/engine.ts) direto pro avatar_url do lead.
 *  contatos.avatar_url aceita uma URL externa sem problema — só é
 *  substituída por uma signed URL do R2 quando avatar_storage_object_id
 *  também está preenchido (ver resolveContatoAvatars em actions/contatos.ts);
 *  sem esse campo, o valor cru passa direto pra tela, igual o fluxo de
 *  automação (lib/social/engine.ts::maybeCreateLead) já faz hoje. */
export async function createLeadFromSocialConversation(orgSlug: string, conversationId: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()

  const { data: conv } = await supabase
    .from('social_conversations')
    .select('id, contato_id, sender_name, sender_username, sender_avatar_url')
    .eq('id', conversationId)
    .eq('organization_id', g.org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada.' }
  if (conv.contato_id) return { ok: false as const, error: 'Esta conversa já tem um lead vinculado.' }

  // Dedup: se já existe um contato com esse @Instagram (cadastrado manualmente
  // ou criado numa conversa/automação anterior), reaproveita em vez de criar
  // outro — só vincula a conversa a ele.
  if (conv.sender_username) {
    const { data: existingContato } = await supabase
      .from('contatos')
      .select('id')
      .eq('organization_id', g.org.id)
      .ilike('instagram_username', conv.sender_username)
      .maybeSingle()
    if (existingContato) {
      await supabase
        .from('social_conversations')
        .update({ contato_id: existingContato.id })
        .eq('id', conv.id)
        .eq('organization_id', g.org.id)
      revalidatePath(`/app/${orgSlug}/social/inbox`)
      return { ok: true as const, leadId: existingContato.id, reused: true as const }
    }
  }

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', g.org.id)
    .eq('is_default', true)
    .maybeSingle()
  if (!pipeline) return { ok: false as const, error: 'Nenhum pipeline padrão configurado.' }

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipeline.id)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStage) return { ok: false as const, error: 'Pipeline sem estágios.' }

  const { data: lead, error: leadErr } = await supabase
    .from('contatos')
    .insert({
      organization_id: g.org.id,
      pipeline_id:     pipeline.id,
      stage_id:        firstStage.id,
      name:            conv.sender_name || (conv.sender_username ? `@${conv.sender_username}` : 'Lead do Instagram'),
      source:          'instagram',
      instagram_username: conv.sender_username || null,
      avatar_url:      conv.sender_avatar_url || null,
    })
    .select('id')
    .single()
  if (leadErr || !lead) return { ok: false as const, error: leadErr?.message || 'Falha ao criar lead.' }

  await supabase
    .from('social_conversations')
    .update({ contato_id: lead.id })
    .eq('id', conv.id)
    .eq('organization_id', g.org.id)

  revalidatePath(`/app/${orgSlug}/social/inbox`)
  return { ok: true as const, leadId: lead.id }
}
