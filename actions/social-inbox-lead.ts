'use server'

/**
 * PAINEL DE DETALHES DO LEAD (Instagram) — equivalente ao que
 * actions/whatsapp.ts::getConversationContext/createLeadFromConversation
 * fazem para o WhatsApp. Alimenta components/features/social/
 * SocialLeadDetailPanel.tsx. Split out of actions/social-inbox.ts.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { guard } from './social-inbox-send'

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
