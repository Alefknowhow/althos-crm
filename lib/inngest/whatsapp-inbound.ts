/**
 * Processa uma mensagem recebida no WhatsApp com o Agente IA (mesmo motor
 * usado no sandbox de Configurações → Agente IA — lib/ai/attendant-engine.ts).
 *
 * O webhook (app/api/webhooks/whatsapp/route.ts) só grava a mensagem e
 * enfileira este evento — quem chama a Anthropic e manda a resposta pra
 * Meta é esta function, fora do ciclo de resposta rápido que a Meta espera.
 * Mesmo padrão do Instagram (lib/inngest/social-inbound.ts).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/whatsapp/meta-client'
import { respondAsAttendant } from '@/lib/ai/attendant-engine'
import { ATTENDANT_TOOLS, executeAttendantTool } from '@/lib/ai/attendant-tools'
import { getPlatformAiKey } from '@/lib/ai/api-key'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'

export type WhatsappInboundEvent = {
  orgId: string
  conversationId: string
  metaMessageId: string
}

/** Extrai o texto de uma mensagem salva (cobre os dois formatos de content
 *  usados no histórico — igual ao msgBody() de WhatsappChat.tsx). */
function msgText(m: { content: any; type: string }): string {
  return m.content?.text?.body || m.content?.body || ''
}

export const processWhatsappInboundFn = inngest.createFunction(
  {
    id:      'process-whatsapp-inbound',
    name:    'WhatsApp: Agente IA responde mensagem recebida',
    retries: 2,
    triggers: [{ event: 'whatsapp/inbound.received' }],
  },
  async ({ event }: { event: { data: WhatsappInboundEvent } }) => {
    const { orgId, conversationId, metaMessageId } = event.data
    const admin = createAdminClient()

    const { data: org } = await admin
      .from('organizations')
      .select('id, name, account_id, whatsapp_phone_number_id, whatsapp_access_token, ai_business_context, ai_qualifier_model')
      .eq('id', orgId)
      .maybeSingle()
    if (!org) return { skipped: 'org-not-found' }

    // Feature gate — Agente IA é recurso pago (a partir do Pro), mesma
    // checagem do sandbox.
    if (org.account_id && !(await checkFeatureAccess(org.account_id, 'ai_attendant'))) {
      return { skipped: 'feature-locked' }
    }

    const { data: attendant } = await admin
      .from('ai_attendant_config')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle()
    // IA global desligada (ou nunca configurada) — não responde nada. O
    // atendimento continua 100% manual, como sempre foi.
    if (!attendant?.is_enabled) return { skipped: 'ai-disabled' }

    const { data: conv } = await admin
      .from('whatsapp_conversations')
      .select('id, contact_phone, contact_name, contato_id, automation_paused, ai_replies_count')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conv) return { skipped: 'conversation-not-found' }
    // Conversa pausada (atendente assumiu manualmente) — IA não entra.
    if (conv.automation_paused) return { skipped: 'conversation-paused' }

    const maxReplies = attendant.max_replies_per_conversation ?? 30
    if ((conv.ai_replies_count || 0) >= maxReplies) {
      // Teto de segurança atingido — pausa a IA nesta conversa em vez de
      // continuar tentando (evita loop/gasto descontrolado) e deixa pro
      // atendente humano assumir.
      await admin.from('whatsapp_conversations').update({ automation_paused: true }).eq('id', conv.id)
      return { skipped: 'max-replies-reached' }
    }

    // Idempotência: se já existe uma mensagem de saída mais recente que a
    // que disparou este evento, alguém (IA num retry, ou o próprio
    // atendente) já respondeu — não duplica.
    const { data: triggerMsg } = await admin
      .from('whatsapp_messages')
      .select('id, created_at')
      .eq('meta_message_id', metaMessageId)
      .maybeSingle()
    if (!triggerMsg) return { skipped: 'trigger-message-not-found' }

    const { data: newerOutbound } = await admin
      .from('whatsapp_messages')
      .select('id')
      .eq('conversation_id', conv.id)
      .eq('direction', 'outbound')
      .gt('created_at', triggerMsg.created_at)
      .limit(1)
      .maybeSingle()
    if (newerOutbound) return { skipped: 'already-answered' }

    const apiKey = getPlatformAiKey()
    if (!apiKey) return { skipped: 'no-api-key' }

    // Créditos de IA por conta — mesmo medidor do sandbox e do Instagram.
    if (org.account_id) {
      const credit = await consumeAiCredits({
        accountId: org.account_id,
        action:    'ai_attendant_reply',
        metadata:  { feature: 'ai_attendant', conversationId: conv.id, context: 'whatsapp' },
      })
      if (!credit.success) return { skipped: 'insufficient_credits' }
    }

    const { data: knowledge } = await admin
      .from('ai_knowledge_items')
      .select('category, question, answer, priority')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('priority', { ascending: false })

    let leadProfile: any = null
    if (conv.contato_id) {
      const { data: lead } = await admin
        .from('contatos')
        .select('name, phone, email, source, tags')
        .eq('id', conv.contato_id)
        .maybeSingle()
      if (lead) leadProfile = lead
    }

    const { data: history } = await admin
      .from('whatsapp_messages')
      .select('direction, type, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const messages = (history || [])
      .slice()
      .reverse()
      .map(m => ({ role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant', content: msgText(m as any) }))
      .filter(m => m.content.trim() !== '')
    if (messages.length === 0) return { skipped: 'no-text-history' }

    let result
    try {
      result = await respondAsAttendant(
        {
          personaPrompt:   attendant.persona_prompt,
          businessContext: org.ai_business_context,
          knowledgeBase:   (knowledge || []) as any,
          handoffPhrases:  (attendant.handoff_phrases as any) || [],
          leadProfile,
          orgName: org.name,
          messages,
          tools: ATTENDANT_TOOLS,
          executeTool: (name, input) => executeAttendantTool(name, input, { orgId, supabase: admin as any }),
        },
        {
          apiKey,
          model: org.ai_qualifier_model || 'claude-haiku-4-5',
          maxOutputTokens: 600,
        },
      )
    } catch (e: any) {
      console.error('[whatsapp inbound] falha ao gerar resposta da IA:', e?.message)
      return { skipped: 'ai-error', error: e?.message }
    }

    if (!result.reply.trim()) return { skipped: 'empty-reply' }

    const { data: outMsg, error: insertError } = await admin
      .from('whatsapp_messages')
      .insert({
        conversation_id: conv.id,
        organization_id: orgId,
        direction: 'outbound',
        type: 'text',
        content: { body: result.reply },
        status: 'sending',
        sent_by_name: 'IA',
      })
      .select()
      .single()
    if (insertError || !outMsg) return { skipped: 'insert-failed', error: insertError?.message }

    await admin.from('whatsapp_conversations').update({
      last_message_at:        new Date().toISOString(),
      last_message_preview:   result.reply,
      last_message_direction: 'outbound',
      last_message_status:    'sending',
      ai_replies_count:       (conv.ai_replies_count || 0) + 1,
      // Pedido de transferência: a IA já respondeu (avisando que vai
      // chamar alguém), mas a partir daqui a conversa fica sob controle
      // humano — próxima mensagem do cliente não aciona a IA de novo.
      ...(result.handoffRequested ? { automation_paused: true } : {}),
    }).eq('id', conv.id)

    try {
      const metaRes = await sendTextMessage(org, conv.contact_phone, result.reply)
      await admin.from('whatsapp_messages').update({
        meta_message_id: metaRes.messages[0].id,
        status: 'sent',
      }).eq('id', outMsg.id)
      await admin.from('whatsapp_conversations').update({ last_message_status: 'sent' }).eq('id', conv.id)
    } catch (e: any) {
      await admin.from('whatsapp_messages').update({
        status: 'failed',
        content: { body: result.reply, error: e?.message },
      }).eq('id', outMsg.id)
      await admin.from('whatsapp_conversations').update({ last_message_status: 'failed' }).eq('id', conv.id)
      return { skipped: 'send-failed', error: e?.message }
    }

    return { ok: true, handoffRequested: result.handoffRequested }
  },
)
