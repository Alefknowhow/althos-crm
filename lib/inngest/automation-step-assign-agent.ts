/**
 * Step "Iniciar/atribuir conversa a Agente IA" (issue #18, seção "Agentes IA
 * como etapas conversacionais do Workflow") — extraído de
 * automation-step-executor.ts só por tamanho de arquivo (limite de 350
 * linhas do projeto).
 *
 * Referencia um Agent Definition (issue #19) por ID — nunca duplica
 * personalidade/prompt aqui, que continuam só em `agent_definitions`. O que
 * este step faz é uma ATRIBUIÇÃO POR CONVERSA: grava em
 * `whatsapp_conversations.assigned_agent_definition_id` (+ objetivo desta
 * execução), que `lib/inngest/whatsapp-inbound.ts` passa a preferir sobre a
 * atribuição padrão por cenário (`agent_assignments`) na próxima mensagem
 * inbound dessa conversa.
 *
 * Escopo deliberado: isto é "atribuir e seguir em frente" (fire-and-forget)
 * — a automação não pausa esperando o agente terminar um objetivo
 * multi-turn (isso exigiria uma tabela de "sessão de execução do agente"
 * que ainda não existe; ver auditoria da issue #18/#19). agentDefinitionId
 * vazio desatribui, revertendo pro comportamento padrão da conversa.
 */

import type { createAdminClient } from '../supabase/server'

function interpolateLeadVars(value: string, lead: any): string {
  return value
    .replace(/\{\{lead\.name\}\}/g,  lead?.name  || '')
    .replace(/\{\{lead\.email\}\}/g, lead?.email || '')
    .replace(/\{\{lead\.phone\}\}/g, lead?.phone || '')
}

export async function executeAssignAgentStep(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  lead: any,
  config: Record<string, any>,
): Promise<{ status: 'success' | 'error'; message: string | null; sent: Record<string, any> | null }> {
  const agentDefinitionId: string = config.agentDefinitionId || ''
  const objective = config.objective ? interpolateLeadVars(config.objective, lead) : null

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('contato_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conv) return { status: 'error', message: 'Lead ainda não tem conversa de WhatsApp para atribuir.', sent: null }

  if (!agentDefinitionId) {
    await supabase.from('whatsapp_conversations').update({
      assigned_agent_definition_id: null,
      assigned_agent_objective: null,
      assigned_agent_source: null,
      assigned_agent_started_at: null,
    }).eq('id', conv.id)
    return { status: 'success', message: null, sent: { conversationId: conv.id, unassigned: true } }
  }

  const { data: agentDef } = await supabase
    .from('agent_definitions')
    .select('id')
    .eq('id', agentDefinitionId)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle()
  if (!agentDef) return { status: 'error', message: 'Agente IA não encontrado ou inativo.', sent: null }

  await supabase.from('whatsapp_conversations').update({
    assigned_agent_definition_id: agentDefinitionId,
    assigned_agent_objective: objective,
    assigned_agent_source: 'automation',
    assigned_agent_started_at: new Date().toISOString(),
    // Não mexe em automation_paused de propósito — se um atendente humano
    // já assumiu a conversa manualmente, atribuir um agente aqui não deve
    // reativar a IA por baixo dele.
  }).eq('id', conv.id)

  return { status: 'success', message: null, sent: { conversationId: conv.id, agentDefinitionId, objective } }
}
