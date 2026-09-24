/**
 * Execução do passo "DM do Instagram" (send_instagram_dm) — extraído de
 * automation-step-executor.ts só por tamanho de arquivo (limite de 350
 * linhas do projeto), sem mudança de comportamento. Suporta mensagem fixa
 * ou gerada por IA (config.mode === 'ai').
 */

import type { createAdminClient } from '../supabase/server'

function interpolateLeadVars(value: string, lead: any): string {
  return value
    .replace(/\{\{lead\.name\}\}/g,  lead?.name  || '')
    .replace(/\{\{lead\.email\}\}/g, lead?.email || '')
    .replace(/\{\{lead\.phone\}\}/g, lead?.phone || '')
}

export async function runSendInstagramDmStep(
  config: Record<string, any>,
  ctx: { supabase: ReturnType<typeof createAdminClient>; orgId: string; orgConfig: any; lead: any },
): Promise<{ status: 'success' | 'error'; message: string | null; sent: Record<string, any> | null }> {
  const { supabase, orgId, orgConfig, lead } = ctx
  const aiMode = config.mode === 'ai'
  if (aiMode ? !config.aiInstructions : !config.message) return { status: 'success', message: null, sent: null }

  // Resolve a conversa/conexão do Instagram vinculadas a este lead — o
  // motor genérico não tem IGSID/token de conta próprios, só o que já está
  // salvo em social_conversations/social_connections pra esse contato
  // (precisa ter chegado uma DM dele antes, mesma pré-condição do funil de
  // DM antigo).
  const { data: conv } = await supabase
    .from('social_conversations')
    .select('id, sender_external_id, social_connection_id')
    .eq('contato_id', lead.id)
    .eq('organization_id', orgId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!conv) return { status: 'error', message: 'Lead sem conversa de Instagram vinculada.', sent: null }

  const { data: conn } = await supabase
    .from('social_connections')
    .select('page_id, access_token')
    .eq('id', conv.social_connection_id)
    .maybeSingle()
  if (!conn?.access_token) return { status: 'error', message: 'Conexão do Instagram não encontrada.', sent: null }

  let text: string
  if (aiMode) {
    const { hasPlatformAiKey, resolveAnthropicEngine } = await import('@/lib/ai/api-key')
    if (!hasPlatformAiKey()) return { status: 'error', message: 'IA não configurada.', sent: null }
    if (orgConfig?.account_id) {
      const { consumeAiCredits } = await import('@/lib/plans/server')
      const credit = await consumeAiCredits({
        accountId: orgConfig.account_id, action: 'instagram_ai_reply',
        model: orgConfig.ai_qualifier_model, metadata: { feature: 'automations', orgId },
      })
      if (!credit.success) return { status: 'error', message: 'Créditos de IA insuficientes pra gerar a mensagem.', sent: null }
    }
    const { apiKey, baseURL } = await resolveAnthropicEngine()
    const { generateAiMessage } = await import('@/lib/social/ai')
    text = await generateAiMessage({
      apiKey, baseURL, model: orgConfig?.ai_qualifier_model, orgName: orgConfig?.name,
      businessContext: orgConfig?.ai_business_context, instructions: config.aiInstructions, lead,
    })
    const { logAiExecution } = await import('@/lib/agent/audit')
    await logAiExecution({ organizationId: orgId, userId: null, agentLabel: 'internal:social_ai', tool: 'generate_message', status: text ? 'success' : 'error', error: text ? undefined : 'IA não gerou texto.' })
    if (!text) return { status: 'error', message: 'IA não gerou texto pra mensagem.', sent: null }
  } else {
    text = interpolateLeadVars(config.message, lead)
  }

  const buttons = (config.buttons || []).filter((b: any) => b.label && b.value).slice(0, 3)
  const sent = { to: conv.sender_external_id, text, buttons: buttons.length || undefined }

  const { sendInstagramDM } = await import('@/lib/social/instagram')
  await sendInstagramDM(conn.page_id, conn.access_token, conv.sender_external_id, text, buttons.length ? buttons : undefined)

  const { logOutboundMessage } = await import('@/lib/social/conversation-log')
  await logOutboundMessage(supabase, conv.id, orgId, text, 'automation')

  return { status: 'success', message: null, sent }
}
