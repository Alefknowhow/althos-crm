'use server'

/**
 * AI-suggested reply, handoff-summary dismissal, and creating a lead
 * from a conversation. Split out of actions/whatsapp.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccessByOrgSlug, consumeAiCredits } from '@/lib/plans/server'
import { getPlatformAiKey } from '@/lib/ai/api-key'
import { respondAsAttendant } from '@/lib/ai/attendant-engine'

const WHATSAPP_UPGRADE_ERROR = 'WhatsApp não está incluído no seu plano atual. Faça upgrade para o Pro ou Business para usar este recurso.'

function msgTextForSuggestion(m: { content: any; type: string }): string {
  return m.content?.text?.body || m.content?.body || ''
}

/**
 * "Sugestão de resposta" — botão manual no composer do WhatsApp: a IA lê o
 * histórico da conversa e devolve um texto pronto, que o atendente ainda
 * revisa e decide se envia (não dispara nada sozinho, ao contrário do
 * Agente IA automático de lib/inngest/whatsapp-inbound.ts). Reaproveita o
 * mesmo motor (respondAsAttendant), sem tools (sugestão não deve mudar
 * estágio/tag por conta própria) e sem as checagens de automação (horário,
 * pausa, teto de respostas) que só fazem sentido pro fluxo automático.
 */
export async function suggestWhatsappReply(orgSlug: string, conversationId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'ai_attendant'))) {
    return { ok: false as const, error: WHATSAPP_UPGRADE_ERROR }
  }

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, contato_id')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada.' }

  const apiKey = getPlatformAiKey()
  if (!apiKey) return { ok: false as const, error: 'IA não configurada para esta conta.' }

  const orgAny = org as any
  if (orgAny.account_id) {
    const credit = await consumeAiCredits({
      accountId: orgAny.account_id,
      action: 'ai_attendant_reply',
      metadata: { feature: 'ai_attendant_suggestion', conversationId },
    })
    if (!credit.success) return { ok: false as const, error: 'Créditos de IA insuficientes.' }
  }

  const { data: attendant } = await supabase
    .from('ai_attendant_config')
    .select('persona_prompt, guided_steps, handoff_phrases, memory_enabled')
    .eq('organization_id', org.id)
    .maybeSingle()

  let leadProfile: any = null
  if (conv.contato_id) {
    const { data: lead } = await supabase
      .from('contatos')
      .select('name, phone, email, source, tags, ai_memory_notes')
      .eq('id', conv.contato_id)
      .maybeSingle()
    if (lead) leadProfile = { ...lead, memoryNotes: attendant?.memory_enabled ? lead.ai_memory_notes : null }
  }

  const { data: history } = await supabase
    .from('whatsapp_messages')
    .select('direction, type, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20)

  const messages = (history || [])
    .slice()
    .reverse()
    .map(m => ({ role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant', content: msgTextForSuggestion(m as any) }))
    .filter(m => m.content.trim() !== '')
  if (messages.length === 0) return { ok: false as const, error: 'Sem histórico de texto pra sugerir resposta.' }

  try {
    const result = await respondAsAttendant(
      {
        personaPrompt:   attendant?.persona_prompt || 'Você é um atendente cordial e objetivo.',
        businessContext: null,
        knowledgeBase:   [],
        handoffPhrases:  (attendant?.handoff_phrases as any) || [],
        guidedSteps:     (attendant?.guided_steps as any as string[]) || [],
        leadProfile,
        orgName: org.name,
        messages,
        tools: [],
      },
      { apiKey, model: 'claude-haiku-4-5', maxOutputTokens: 400 },
    )
    if (!result.reply.trim()) return { ok: false as const, error: 'A IA não gerou nenhuma sugestão.' }
    return { ok: true as const, suggestion: result.reply }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao gerar sugestão.' }
  }
}

/**
 * Cria um lead a partir do contato do WhatsApp e vincula à conversa. Usado
 * quando a conversa ainda não tem lead. Cai no primeiro estágio do pipeline
 * padrão.
 */
/** Limpa o resumo de handoff da IA depois que o atendente leu. */
export async function dismissHandoffSummary(orgSlug: string, conversationId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({ ai_handoff_summary: null, ai_handoff_at: null })
    .eq('id', conversationId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const }
}

export async function createLeadFromConversation(orgSlug: string, conversationId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, contato_id, contact_name, contact_phone')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada.' }
  if (conv.contato_id) return { ok: false as const, error: 'Esta conversa já tem um lead vinculado.' }

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', org.id)
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
      organization_id: org.id,
      pipeline_id:     pipeline.id,
      stage_id:        firstStage.id,
      name:            conv.contact_name || conv.contact_phone,
      phone:           conv.contact_phone,
      source:          'whatsapp',
    })
    .select('id')
    .single()
  if (leadErr || !lead) return { ok: false as const, error: leadErr?.message || 'Falha ao criar lead.' }

  await supabase
    .from('whatsapp_conversations')
    .update({ contato_id: lead.id })
    .eq('id', conv.id)
    .eq('organization_id', org.id)

  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const, leadId: lead.id }
}
