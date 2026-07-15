/**
 * Motor do funil de conversa em DM.
 *
 * Numa DM recebida:
 *  - Se a pessoa já está num funil (estado ativo) → avança para o próximo passo.
 *  - Senão, procura um funil ativo cujo gatilho case (palavras-chave) → inicia.
 *
 * Cada passo é mensagem fixa ou resposta por IA. Passos com wait_for_reply=false
 * são enviados em sequência imediata; wait_for_reply=true pausa até a pessoa
 * responder (o que reabre a janela de 24h da Meta). Ao esgotar os passos, o
 * estado vira 'done'.
 *
 * Retorna true se o funil tratou a DM (o motor de automação simples deve pular).
 */

import type { createAdminClient } from '@/lib/supabase/server'
import { sendInstagramDM, privateReplyToComment } from '@/lib/social/instagram'
import { generateAiReply } from '@/lib/social/ai'
import { logOutboundMessage } from '@/lib/social/conversation-log'

type Admin = ReturnType<typeof createAdminClient>

type Connection = {
  id: string
  organization_id: string
  page_id: string
  access_token: string
}

type Inbound = {
  igAccountId: string
  senderId: string
  senderUsername?: string | null
  text: string
  isStoryReply?: boolean
}

type Step = {
  sort_order: number
  step_type: 'message' | 'ai'
  message_text: string | null
  ai_instructions: string | null
  wait_for_reply: boolean
}

async function renderStep(
  admin: Admin, orgId: string, step: Step, inbound: Inbound,
): Promise<string> {
  if (step.step_type === 'message') return (step.message_text || '').trim()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ''
  const { data: org } = await admin
    .from('organizations')
    .select('name, ai_business_context, ai_qualifier_model')
    .eq('id', orgId).maybeSingle()
  try {
    return await generateAiReply({
      apiKey,
      model: org?.ai_qualifier_model,
      orgName: org?.name,
      businessContext: org?.ai_business_context,
      instructions: step.ai_instructions,
      inboundKind: 'dm',
      inboundText: inbound.text,
      senderUsername: inbound.senderUsername,
    })
  } catch (e: any) {
    console.error('[funnel] AI step failed:', e?.message)
    return ''
  }
}

/**
 * Envia os passos a partir de `fromIndex`, parando no primeiro passo com
 * wait_for_reply (inclusive) ou ao fim. Retorna o índice do próximo passo a
 * executar (ou steps.length se terminou).
 */
async function runFrom(
  admin: Admin, connection: Connection, inbound: Inbound, steps: Step[], fromIndex: number,
  conversationId?: string,
): Promise<number> {
  let i = fromIndex
  while (i < steps.length) {
    const step = steps[i]
    const text = await renderStep(admin, connection.organization_id, step, inbound)
    if (text.trim()) {
      try {
        await sendInstagramDM(connection.page_id, connection.access_token, inbound.senderId, text)
        if (conversationId) {
          await logOutboundMessage(admin, conversationId, connection.organization_id, text, 'funnel')
        }
      } catch (e: any) {
        console.error('[funnel] send failed:', e?.message)
      }
    }
    i++
    if (step.wait_for_reply) break // pausa até a próxima mensagem da pessoa
  }
  return i
}

function funnelMatches(kws: string[] | null, text: string): boolean {
  const list = (kws || []).map(k => k.toLowerCase().trim()).filter(Boolean)
  if (list.length === 0) return true // sem palavra-chave = qualquer primeira DM
  const hay = text.toLowerCase()
  return list.some(k => hay.includes(k))
}

export async function runFunnelForInbound(
  admin: Admin, connection: Connection, inbound: Inbound, conversationId?: string,
): Promise<boolean> {
  // 1) Já existe conversa ativa deste remetente nesta conta?
  const { data: state } = await admin
    .from('social_conversation_state')
    .select('id, funnel_id, current_step, status')
    .eq('social_connection_id', connection.id)
    .eq('sender_external_id', inbound.senderId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let funnelId: string
  let startIndex: number
  let stateId: string | null = null

  if (state) {
    funnelId = (state as any).funnel_id
    startIndex = (state as any).current_step
    stateId = (state as any).id
  } else {
    // 2) Procura um funil ativo cujo gatilho case. Resposta a story tem
    //    prioridade para funis 'story_reply'; senão, funis de 'dm'.
    const triggerTypes = inbound.isStoryReply ? ['story_reply', 'dm'] : ['dm']
    const { data: funnels } = await admin
      .from('social_funnels')
      .select('id, trigger_type, trigger_keywords')
      .eq('organization_id', connection.organization_id)
      .in('trigger_type', triggerTypes)
      .eq('is_active', true)
    // Ordena story_reply antes de dm quando aplicável.
    const ordered = (funnels || []).sort((a: any, b: any) =>
      triggerTypes.indexOf(a.trigger_type) - triggerTypes.indexOf(b.trigger_type))
    const hit = ordered.find((f: any) => funnelMatches(f.trigger_keywords, inbound.text))
    if (!hit) return false
    funnelId = (hit as any).id
    startIndex = 0
  }

  // 3) Carrega os passos do funil.
  const { data: stepsData } = await admin
    .from('social_funnel_steps')
    .select('sort_order, step_type, message_text, ai_instructions, wait_for_reply')
    .eq('funnel_id', funnelId)
    .order('sort_order', { ascending: true })
  const steps = (stepsData || []) as Step[]
  if (steps.length === 0 || startIndex >= steps.length) {
    // Nada a enviar / já terminou.
    if (stateId) await admin.from('social_conversation_state').update({ status: 'done' }).eq('id', stateId)
    return !!state // consumiu a DM se havia estado ativo
  }

  // 4) Executa a partir do passo atual.
  const nextIndex = await runFrom(admin, connection, inbound, steps, startIndex, conversationId)
  const done = nextIndex >= steps.length

  // 5) Persiste o estado.
  if (stateId) {
    await admin.from('social_conversation_state').update({
      current_step: nextIndex,
      status: done ? 'done' : 'active',
      last_advanced_at: new Date().toISOString(),
    }).eq('id', stateId)
  } else {
    await admin.from('social_conversation_state').insert({
      organization_id: connection.organization_id,
      funnel_id: funnelId,
      social_connection_id: connection.id,
      sender_external_id: inbound.senderId,
      current_step: nextIndex,
      status: done ? 'done' : 'active',
      last_advanced_at: new Date().toISOString(),
    })
  }
  return true
}

/**
 * Início de funil a partir de um COMENTÁRIO: se um funil de gatilho 'comment'
 * casa, envia o 1º passo como resposta privada ao comentário (abre a DM) e
 * cria o estado da conversa. Os próximos passos continuam quando a pessoa
 * responder na DM (via runFunnelForInbound). Retorna true se iniciou um funil.
 */
export async function startCommentFunnel(
  admin: Admin,
  connection: Connection,
  inbound: { senderId: string; text: string; commentId: string },
): Promise<boolean> {
  // Já existe conversa ativa com esta pessoa? Não duplica.
  const { data: existing } = await admin
    .from('social_conversation_state')
    .select('id')
    .eq('social_connection_id', connection.id)
    .eq('sender_external_id', inbound.senderId)
    .eq('status', 'active')
    .maybeSingle()
  if (existing) return true

  const { data: funnels } = await admin
    .from('social_funnels')
    .select('id, trigger_keywords')
    .eq('organization_id', connection.organization_id)
    .eq('trigger_type', 'comment')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  const hit = (funnels || []).find((f: any) => funnelMatches(f.trigger_keywords, inbound.text))
  if (!hit) return false
  const funnelId = (hit as any).id

  const { data: stepsData } = await admin
    .from('social_funnel_steps')
    .select('sort_order, step_type, message_text, ai_instructions, wait_for_reply')
    .eq('funnel_id', funnelId)
    .order('sort_order', { ascending: true })
  const steps = (stepsData || []) as Step[]
  if (steps.length === 0) return false

  // 1º passo vai como resposta privada ao comentário (inicia a DM).
  const first = steps[0]
  const text = await renderStep(admin, connection.organization_id, first, {
    igAccountId: connection.page_id, senderId: inbound.senderId, text: inbound.text,
  })
  if (text.trim()) {
    try {
      await privateReplyToComment(connection.page_id, connection.access_token, inbound.commentId, text)
    } catch (e: any) {
      console.error('[funnel] comment private reply failed:', e?.message)
      return false
    }
  }

  const done = steps.length <= 1
  await admin.from('social_conversation_state').insert({
    organization_id: connection.organization_id,
    funnel_id: funnelId,
    social_connection_id: connection.id,
    sender_external_id: inbound.senderId,
    current_step: 1,
    status: done ? 'done' : 'active',
    last_advanced_at: new Date().toISOString(),
  })
  return true
}
