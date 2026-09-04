/**
 * Social interaction engine: given an inbound Instagram DM or comment, find a
 * matching automation rule, generate the reply (AI or fixed), send it back via
 * the Graph API, optionally create a lead, and log everything.
 *
 * Called by the Instagram webhook (app/api/webhooks/instagram/route.ts).
 *
 * Types + helpers (Automation, matches, maybeCreateLead, logPendingComment,
 * rehostInboundAttachment) split out to engine-helpers.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  sendInstagramDM,
  replyToComment,
  privateReplyToComment,
  getInstagramUserProfile,
} from '@/lib/social/instagram'
import { generateAiReply } from '@/lib/social/ai'
import { runFunnelForInbound, startCommentFunnel } from '@/lib/social/funnel-engine'
import { getOrCreateConversation, enrichConversationProfile, logInboundMessage, logOutboundMessage } from '@/lib/social/conversation-log'
import { inngest } from '@/lib/inngest/client'
import { consumeAiCredits } from '@/lib/plans/server'
import {
  matches, maybeCreateLead, logPendingComment, rehostInboundAttachment,
  type InboundInteraction, type Automation,
} from './engine-helpers'

export type { InboundInteraction } from './engine-helpers'

/**
 * Process a single inbound interaction end-to-end. Safe to call per webhook
 * event; failures are caught and logged so one bad event can't 500 the webhook.
 */
export async function processInboundInteraction(inbound: InboundInteraction): Promise<void> {
  const supabase = createAdminClient()

  // 1) Resolve the connection by the IG account id (webhook entry id).
  const { data: connection } = await supabase
    .from('social_connections')
    .select('id, organization_id, page_id, access_token, is_active')
    .eq('page_id', inbound.igAccountId)
    .eq('platform', 'instagram')
    .maybeSingle()

  if (!connection || !connection.is_active || !connection.access_token) return
  const orgId = connection.organization_id

  // 2) Idempotency for DMs (Meta re-delivers webhooks).
  if (inbound.mid) {
    const { data: dup } = await supabase
      .from('social_interactions')
      .select('id')
      .eq('organization_id', orgId)
      .eq('raw_payload->>mid', inbound.mid)
      .maybeSingle()
    if (dup) return
  }

  // 2.4) Inbox manual: registra a mensagem inbound no histórico da conversa
  //      (independente de automação) — feito ANTES de qualquer chamada de
  //      rede evitável (perfil, notificação), de propósito: é o passo que
  //      faz a mensagem aparecer no inbox em tempo real (via Supabase
  //      Realtime), então quanto antes ele rodar, mais rápido o revisor/
  //      cliente vê a mensagem chegando. Se um atendente já assumiu a
  //      conversa (automation_paused), a automação/funil não responde — só
  //      o histórico é atualizado, o atendente responde pelo inbox.
  let conversationId: string | undefined
  let automationPaused = false
  let mediaOnly = false
  if (inbound.kind === 'dm') {
    try {
      const conversation = await getOrCreateConversation(supabase, {
        organizationId: orgId,
        connectionId: connection.id,
        senderId: inbound.senderId,
        senderUsername: inbound.senderUsername,
      })
      const rehostedUrl = inbound.attachmentUrl && inbound.attachmentType
        ? await rehostInboundAttachment(orgId, conversation.id, inbound.attachmentUrl, inbound.attachmentType)
        : inbound.attachmentUrl
      await logInboundMessage(supabase, conversation.id, orgId, inbound.text, rehostedUrl, inbound.attachmentType)
      conversationId = conversation.id
      automationPaused = conversation.automationPaused
      mediaOnly = !inbound.text && !!inbound.attachmentUrl

      // Nome/foto do remetente (perfil completo) só chegam agora, depois da
      // mensagem já estar visível — evita que essa chamada de rede atrase o
      // que aparece no inbox. Atualiza via realtime UPDATE um instante depois.
      if (conversation.needsProfileEnrichment) {
        await enrichConversationProfile(supabase, conversation.id, async () => {
          const profile = await getInstagramUserProfile(inbound.senderId, connection.access_token)
          if (!profile) return null
          return { name: profile.name, username: profile.username, avatarUrl: profile.profilePic }
        })
      }
    } catch (e: any) {
      console.error('[social engine] conversation log failed:', e?.message)
    }
  }

  // 2.3) Avisa a equipe (push + sino de notificações) que chegou uma
  //      interação nova — dispara sempre, antes de qualquer automação/funil
  //      decidir o que fazer com ela, pra não depender de nenhum caminho
  //      específico (mesmo se cair num funil ou a automação_paused pular o
  //      resto, o time ainda fica sabendo que a mensagem chegou). Já roda
  //      depois do passo 2.4 acima, então não atrasa a mensagem aparecendo
  //      no inbox — só a notificação em si é que sai um instante depois.
  try {
    let senderName = inbound.senderUsername ? `@${inbound.senderUsername}` : 'alguém'
    try {
      const profile = await getInstagramUserProfile(inbound.senderId, connection.access_token)
      if (profile?.name) senderName = profile.name
      else if (profile?.username) senderName = `@${profile.username}`
    } catch { /* best-effort — mantém o fallback acima */ }

    await inngest.send({
      name: inbound.kind === 'dm' ? 'instagram/message.received' : 'instagram/comment.received',
      data: {
        orgId,
        senderName,
        text: inbound.text,
      },
    })
  } catch (e: any) {
    console.error('[social engine] notify event failed:', e?.message)
  }

  if (inbound.kind === 'dm' && conversationId) {
    if (automationPaused) return
    // Mensagem só com mídia (sem texto/legenda) — registra no histórico e
    // avisa a equipe, mas não aciona automação/IA (não tem o que
    // interpretar como gatilho).
    if (mediaOnly) return
  }

  // 2.5) Funil de conversa (só DMs): se a pessoa já está num funil ou um funil
  //      de DM casa, o funil trata a mensagem e a automação simples é pulada.
  if (inbound.kind === 'dm') {
    try {
      const handled = await runFunnelForInbound(
        supabase,
        { id: connection.id, organization_id: orgId, page_id: connection.page_id, access_token: connection.access_token },
        { igAccountId: inbound.igAccountId, senderId: inbound.senderId, senderUsername: inbound.senderUsername, text: inbound.text, isStoryReply: inbound.isStoryReply },
        conversationId,
      )
      if (handled) {
        await supabase.from('social_interactions').insert({
          organization_id: orgId,
          social_connection_id: connection.id,
          platform: 'instagram',
          interaction_type: 'dm',
          sender_external_id: inbound.senderId,
          sender_username: inbound.senderUsername ?? null,
          inbound_text: inbound.text,
          response_type: 'fixed',
          responded_at: new Date().toISOString(),
          raw_payload: { mid: inbound.mid ?? null, funnel: true },
        })
        return
      }
    } catch (e: any) {
      console.error('[social engine] funnel failed:', e?.message)
    }
  }

  // 2.6) Comentário que inicia um funil: responde em privado ao comentário e
  //      abre a conversa (os próximos passos seguem na DM). Não impede a regra
  //      simples de comentário (resposta pública) abaixo.
  if (inbound.kind === 'comment' && inbound.commentId) {
    try {
      await startCommentFunnel(
        supabase,
        { id: connection.id, organization_id: orgId, page_id: connection.page_id, access_token: connection.access_token },
        { senderId: inbound.senderId, text: inbound.text, commentId: inbound.commentId },
      )
    } catch (e: any) {
      console.error('[social engine] comment funnel failed:', e?.message)
    }
  }

  // 3) Find a matching active automation.
  const { data: automations } = await supabase
    .from('social_automations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const auto = (automations || []).find(a => matches(a as Automation, inbound.kind, inbound.text)) as
    | Automation
    | undefined
  if (!auto) {
    // Comentário sem automação que bata: fica pendente pra resposta manual
    // (aba Instagram → Comentários), em vez de simplesmente ser descartado.
    if (inbound.kind === 'comment' && inbound.commentId) {
      await logPendingComment(supabase, orgId, connection.id, inbound)
    }
    return
  }

  // 4) Build the response text.
  let responseText = ''
  if (auto.response_type === 'fixed') {
    responseText = auto.fixed_response || ''
  } else {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, ai_business_context, ai_qualifier_model, account_id')
      .eq('id', orgId)
      .maybeSingle()
    // Centralized platform token (env) — same key for every account.
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.warn('[social engine] ANTHROPIC_API_KEY not configured')
      return
    }

    // Créditos de IA por conta — mesmo medidor do WhatsApp (antes só o
    // WhatsApp era cobrado; Instagram gerava resposta de IA de graça).
    if (org?.account_id) {
      const credit = await consumeAiCredits({
        accountId: org.account_id,
        action: 'instagram_ai_reply',
        model: org.ai_qualifier_model,
        metadata: { feature: 'instagram_automation', orgId, context: inbound.kind },
      })
      if (!credit.success) {
        console.warn('[social engine] insufficient AI credits, skipping AI reply')
        return
      }
    }

    try {
      responseText = await generateAiReply({
        apiKey,
        model: org?.ai_qualifier_model,
        orgName: org?.name,
        businessContext: org?.ai_business_context,
        instructions: auto.ai_instructions,
        inboundKind: inbound.kind,
        inboundText: inbound.text,
        senderUsername: inbound.senderUsername,
      })
    } catch (e: any) {
      console.error('[social engine] AI generation failed:', e?.message)
      return
    }
  }
  if (!responseText.trim()) return

  // 5) Send the reply via the right channel.
  const pageToken = connection.access_token
  try {
    if (inbound.kind === 'dm') {
      await sendInstagramDM(inbound.igAccountId, pageToken, inbound.senderId, responseText)
      if (conversationId) {
        await logOutboundMessage(supabase, conversationId, orgId, responseText, 'automation')
      }
    } else {
      // Comment: reply publicly, and optionally also DM the commenter privately.
      if (inbound.commentId) {
        await replyToComment(inbound.commentId, pageToken, responseText)
        if (auto.send_dm_after_comment) {
          await privateReplyToComment(inbound.igAccountId, pageToken, inbound.commentId, responseText)
        }
      }
    }
  } catch (e: any) {
    console.error('[social engine] send failed:', e?.message)
    // Still log the interaction below with no responded_at so it's visible.
  }

  // 6) Optionally create a lead.
  let leadId: string | null = null
  if (auto.create_lead) {
    try {
      leadId = await maybeCreateLead(supabase, orgId, inbound, connection.access_token)
    } catch (e: any) {
      console.error('[social engine] lead creation failed:', e?.message)
    }
  }

  // 7) Log the interaction.
  await supabase.from('social_interactions').insert({
    organization_id: orgId,
    social_connection_id: connection.id,
    social_automation_id: auto.id,
    contato_id: leadId,
    platform: 'instagram',
    interaction_type: inbound.kind,
    sender_external_id: inbound.senderId,
    sender_username: inbound.senderUsername ?? null,
    inbound_text: inbound.text,
    post_id: inbound.postId ?? null,
    response_text: responseText,
    response_type: auto.response_type,
    responded_at: new Date().toISOString(),
    lead_created: !!leadId,
    raw_payload: { mid: inbound.mid ?? null, commentId: inbound.commentId ?? null },
  })
}
