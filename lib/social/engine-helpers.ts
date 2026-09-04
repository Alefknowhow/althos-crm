/**
 * Types + helpers for the Instagram inbound social engine.
 * Split out of lib/social/engine.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { getInstagramUserProfile } from '@/lib/social/instagram'
import { uploadSystemFile } from '@/lib/storage/system'
import type { InboundKind } from '@/lib/social/ai'

export type InboundInteraction = {
  igAccountId: string        // Instagram business account id (= social_connections.page_id)
  kind: InboundKind
  senderId: string           // IGSID of the sender (DM) — for comments may be the commenter id
  senderUsername?: string | null
  text: string
  commentId?: string | null  // present for comments
  postId?: string | null
  mid?: string | null        // message id — used for idempotency on DMs
  isStoryReply?: boolean      // DM that is actually a reply to one of our stories
  attachmentUrl?: string | null
  attachmentType?: 'image' | 'audio' | 'video' | 'document' | null
}

export type Automation = {
  id: string
  name: string
  trigger_type: 'dm' | 'comment' | 'dm_and_comment'
  trigger_keywords: string[] | null
  response_type: 'ai' | 'fixed'
  fixed_response: string | null
  ai_instructions: string | null
  create_lead: boolean
  send_dm_after_comment: boolean
  is_active: boolean
}

/** A rule matches if its trigger type covers this inbound kind AND (no keywords
 *  configured OR the text contains one of them, case-insensitive). */
export function matches(auto: Automation, kind: InboundKind, text: string): boolean {
  if (!auto.is_active) return false
  const typeOk =
    auto.trigger_type === 'dm_and_comment' ||
    (auto.trigger_type === 'dm' && kind === 'dm') ||
    (auto.trigger_type === 'comment' && kind === 'comment')
  if (!typeOk) return false

  const kws = (auto.trigger_keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean)
  if (kws.length === 0) return true
  const haystack = text.toLowerCase()
  return kws.some(k => haystack.includes(k))
}

export async function maybeCreateLead(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  inbound: InboundInteraction,
  accessToken?: string,
): Promise<string | null> {
  const externalRef = inbound.senderUsername ? `@${inbound.senderUsername}` : inbound.senderId

  // De-dupe: don't create a second lead for the same Instagram sender.
  // Primeiro tenta pelo @usuário salvo em contatos.instagram_username — cobre
  // tanto leads criados por este mesmo fluxo automático quanto contatos já
  // cadastrados manualmente (ou vindos de outro canal) com o Instagram
  // preenchido. Cai pra checagem antiga por `source` só como fallback, pra
  // não duplicar leads criados antes dessa coluna existir.
  if (inbound.senderUsername) {
    const { data: byUsername } = await supabase
      .from('contatos')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('instagram_username', inbound.senderUsername)
      .maybeSingle()
    if (byUsername) return byUsername.id
  }

  const { data: existing } = await supabase
    .from('contatos')
    .select('id')
    .eq('organization_id', orgId)
    .eq('source', `instagram:${externalRef}`)
    .maybeSingle()
  if (existing) return existing.id

  // Foto do perfil do Instagram (best-effort — a criação do lead não falha
  // se isso der erro, só fica sem foto).
  let avatarUrl: string | null = null
  if (accessToken) {
    try {
      const profile = await getInstagramUserProfile(inbound.senderId, accessToken)
      avatarUrl = profile?.profilePic ?? null
    } catch { /* best-effort */ }
  }

  const { data: defaultPipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle()
  const { data: defaultStage } = defaultPipeline
    ? await supabase
        .from('pipeline_stages')
        .select('id, pipeline_id')
        .eq('pipeline_id', defaultPipeline.id)
        .order('position')
        .limit(1)
        .maybeSingle()
    : { data: null }

  const { data: lead } = await supabase
    .from('contatos')
    .insert({
      organization_id: orgId,
      pipeline_id: defaultStage?.pipeline_id ?? null,
      stage_id: defaultStage?.id ?? null,
      name: inbound.senderUsername ? `@${inbound.senderUsername}` : 'Lead do Instagram',
      source: `instagram:${externalRef}`,
      instagram_username: inbound.senderUsername || null,
      avatar_url: avatarUrl,
    })
    .select('id')
    .single()
  return lead?.id ?? null
}

/** Registra um comentário que não bateu em nenhuma automação, pra aparecer
 *  na aba Instagram → Comentários (resposta manual). Best-effort + de-dupe
 *  por comment_id (o webhook pode reentregar o mesmo evento). */
export async function logPendingComment(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  connectionId: string,
  inbound: InboundInteraction,
) {
  try {
    const { data: dup } = await supabase
      .from('social_interactions')
      .select('id')
      .eq('organization_id', orgId)
      .eq('raw_payload->>commentId', inbound.commentId)
      .maybeSingle()
    if (dup) return

    await supabase.from('social_interactions').insert({
      organization_id: orgId,
      social_connection_id: connectionId,
      platform: 'instagram',
      interaction_type: 'comment',
      sender_external_id: inbound.senderId,
      sender_username: inbound.senderUsername ?? null,
      inbound_text: inbound.text,
      post_id: inbound.postId ?? null,
      raw_payload: { commentId: inbound.commentId },
    })
  } catch (e: any) {
    console.error('[social engine] logPendingComment failed:', e?.message)
  }
}

/**
 * A URL de mídia que a Meta manda no payload do webhook (attachment.payload.url)
 * é um link temporário do CDN "lookaside" do Instagram — expira em
 * horas/1 dia. Baixa o arquivo e sobe pro Storage Service (R2), pra ter
 * uma URL assinada e cacheada (48h, renovável) em vez de um link que
 * expira sozinho sem nunca ser trocado. Retorna a URL original em
 * qualquer falha (mensagem ainda é salva, só com o link temporário da
 * Meta — mesmo comportamento de hoje, não piora nada).
 */
export async function rehostInboundAttachment(
  orgId: string,
  conversationId: string,
  url: string,
  attachmentType: 'image' | 'audio' | 'video' | 'document',
): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[social engine] attachment fetch failed (${res.status})`)
      return url
    }
    const contentType = res.headers.get('content-type')?.split(';')[0].trim()
      || { image: 'image/jpeg', audio: 'audio/mpeg', video: 'video/mp4', document: 'application/octet-stream' }[attachmentType]
    const bytes = Buffer.from(await res.arrayBuffer())
    const ext = contentType.split('/')[1] || 'bin'

    const uploaded = await uploadSystemFile({
      organizationId: orgId,
      category: 'instagram',
      scopeId: conversationId,
      conversationId,
      filename: `${crypto.randomUUID()}.${ext}`,
      contentType,
      body: bytes,
    })
    if (!uploaded.ok) {
      console.error('[social engine] attachment re-host failed:', uploaded.error)
      return url
    }
    return uploaded.url
  } catch (e: any) {
    console.error('[social engine] attachment re-host failed:', e?.message)
    return url
  }
}
