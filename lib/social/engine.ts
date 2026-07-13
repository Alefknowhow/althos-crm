/**
 * Social interaction engine: given an inbound Instagram DM or comment, find a
 * matching automation rule, generate the reply (AI or fixed), send it back via
 * the Graph API, optionally create a lead, and log everything.
 *
 * Called by the Instagram webhook (app/api/webhooks/instagram/route.ts).
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  sendInstagramDM,
  replyToComment,
  privateReplyToComment,
} from '@/lib/social/instagram'
import { generateAiReply, type InboundKind } from '@/lib/social/ai'
import { runFunnelForInbound, startCommentFunnel } from '@/lib/social/funnel-engine'

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
}

type Automation = {
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
/* generateAiReply agora vem de lib/social/ai.ts (compartilhado com o funil). */

function matches(auto: Automation, kind: InboundKind, text: string): boolean {
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

async function maybeCreateLead(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  inbound: InboundInteraction,
): Promise<string | null> {
  const externalRef = inbound.senderUsername ? `@${inbound.senderUsername}` : inbound.senderId
  // De-dupe: don't create a second lead for the same Instagram sender.
  const { data: existing } = await supabase
    .from('contatos')
    .select('id')
    .eq('organization_id', orgId)
    .eq('source', `instagram:${externalRef}`)
    .maybeSingle()
  if (existing) return existing.id

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
    })
    .select('id')
    .single()
  return lead?.id ?? null
}

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

  // 2.5) Funil de conversa (só DMs): se a pessoa já está num funil ou um funil
  //      de DM casa, o funil trata a mensagem e a automação simples é pulada.
  if (inbound.kind === 'dm') {
    try {
      const handled = await runFunnelForInbound(
        supabase,
        { id: connection.id, organization_id: orgId, page_id: connection.page_id, access_token: connection.access_token },
        { igAccountId: inbound.igAccountId, senderId: inbound.senderId, senderUsername: inbound.senderUsername, text: inbound.text, isStoryReply: inbound.isStoryReply },
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
  if (!auto) return

  // 4) Build the response text.
  let responseText = ''
  if (auto.response_type === 'fixed') {
    responseText = auto.fixed_response || ''
  } else {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, ai_business_context, ai_qualifier_model')
      .eq('id', orgId)
      .maybeSingle()
    // Centralized platform token (env) — same key for every account.
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.warn('[social engine] ANTHROPIC_API_KEY not configured')
      return
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
      leadId = await maybeCreateLead(supabase, orgId, inbound)
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
