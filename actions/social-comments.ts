'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { replyToComment, privateReplyToComment } from '@/lib/social/instagram'

/**
 * Resposta manual a comentários do Instagram que não bateram em nenhuma
 * automação (ver lib/social/engine.ts:logPendingComment) — cria uma fila
 * simples de "pendente" → "respondido" pra atender pelo próprio CRM.
 */

export type PendingComment = {
  id: string
  sender_username: string | null
  sender_name: string | null
  inbound_text: string
  post_id: string | null
  created_at: string
  comment_id: string
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

export async function listPendingComments(orgSlug: string): Promise<PendingComment[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('social_interactions')
    .select('id, sender_username, sender_name, inbound_text, post_id, created_at, raw_payload')
    .eq('organization_id', org.id)
    .eq('platform', 'instagram')
    .eq('interaction_type', 'comment')
    .is('response_type', null)
    .order('created_at', { ascending: false })

  return (data || [])
    .map(r => ({
      id: r.id,
      sender_username: r.sender_username,
      sender_name: r.sender_name,
      inbound_text: r.inbound_text,
      post_id: r.post_id,
      created_at: r.created_at,
      comment_id: (r.raw_payload as any)?.commentId as string,
    }))
    .filter(r => !!r.comment_id)
}

export async function replyToCommentManually(
  orgSlug: string,
  interactionId: string,
  text: string,
  alsoSendDm: boolean,
) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const body = text.trim()
  if (!body) return { ok: false as const, error: 'Resposta vazia' }

  const supabase = createClient()
  const { data: interaction } = await supabase
    .from('social_interactions')
    .select('id, social_connection_id, raw_payload')
    .eq('id', interactionId)
    .eq('organization_id', g.org.id)
    .maybeSingle()
  if (!interaction) return { ok: false as const, error: 'Comentário não encontrado' }
  const commentId = (interaction.raw_payload as any)?.commentId as string | undefined
  if (!commentId) return { ok: false as const, error: 'Comentário sem referência válida' }

  const { data: connection } = await supabase
    .from('social_connections')
    .select('page_id, access_token')
    .eq('id', interaction.social_connection_id)
    .maybeSingle()
  if (!connection?.access_token) return { ok: false as const, error: 'Conexão do Instagram não encontrada' }

  try {
    await replyToComment(commentId, connection.access_token, body)
    if (alsoSendDm) {
      await privateReplyToComment(connection.page_id, connection.access_token, commentId, body)
    }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao responder comentário' }
  }

  await supabase
    .from('social_interactions')
    .update({
      response_text: body,
      response_type: 'manual',
      responded_at: new Date().toISOString(),
    })
    .eq('id', interactionId)

  revalidatePath(`/app/${orgSlug}/social/comentarios`)
  return { ok: true as const }
}
