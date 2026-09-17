/**
 * Ponte entre o webhook do Instagram (lib/social/engine.ts) e o motor
 * genérico de Automações (lib/inngest/automation.ts) — fusão da Fase 3.
 * Extraído de engine.ts só por tamanho de arquivo (limite de 350 linhas do
 * projeto), sem mudança de comportamento.
 *
 * Duas responsabilidades:
 *   - resumeWaitingGenericAutomation: retoma um automation_run pausado num
 *     "Aguardar Resposta" quando a resposta chega (mesmo papel que
 *     runFunnelForInbound cumpre pro motor de funil antigo).
 *   - fireGenericAutomationTrigger: dispara `instagram.dm.received`/
 *     `instagram.comment.received` pra quem configurou uma automação nova
 *     no módulo genérico — só cria/vincula lead se houver alguma automação
 *     ativa esperando esse evento (não gera lead à toa por DM sem automação).
 */

import type { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { maybeCreateLead, type InboundInteraction } from './engine-helpers'

/** @returns true se um run pausado foi encontrado e retomado (o chamador deve parar por aqui). */
export async function resumeWaitingGenericAutomation(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  conversationId: string,
  replyText: string,
): Promise<boolean> {
  const { data: conv } = await supabase
    .from('social_conversations')
    .select('contato_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv?.contato_id) return false

  const { data: waitingRun } = await supabase
    .from('automation_runs')
    .select('*, automations(*)')
    .eq('organization_id', orgId)
    .eq('contato_id', conv.contato_id)
    .eq('status', 'waiting')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const auto = (waitingRun as any)?.automations
  if (!waitingRun || !auto) return false

  const steps: any[] = auto.steps || []
  const waitIdx = steps.findIndex(s => s.id === waitingRun.waiting_for_step_id)
  const waitingStep = waitIdx >= 0 ? steps[waitIdx] : null
  // Passo "DM do Instagram" com botões pausa nele mesmo (ver
  // automation-run-graph.ts) — os botões estão no próprio passo que está
  // esperando. Compatibilidade com o desenho antigo: um "Aguardar
  // Resposta" (wait_for_reply) que pausa DEPOIS de um send_instagram_dm
  // ainda funciona, buscando os botões no passo anterior.
  const prevStep = waitIdx > 0 ? steps[waitIdx - 1] : null
  const buttonsOwner = waitingStep?.type === 'send_instagram_dm' ? waitingStep
    : prevStep?.type === 'send_instagram_dm' ? prevStep
    : null
  const matchedButtonIndex = buttonsOwner
    ? (buttonsOwner.config?.buttons || []).findIndex((b: any) => b.value === replyText)
    : -1

  const { resumeWaitingAutomationRun } = await import('@/lib/inngest/automation')
  await resumeWaitingAutomationRun(supabase, waitingRun, auto, {
    replyText,
    matchedButtonIndex: matchedButtonIndex === -1 ? null : matchedButtonIndex,
  })
  return true
}

export async function fireGenericAutomationTrigger(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  connectionAccessToken: string,
  conversationId: string | undefined,
  inbound: InboundInteraction,
): Promise<void> {
  const eventName = inbound.kind === 'dm' ? 'instagram.dm.received' : 'instagram.comment.received'
  const { data: activeAutos } = await supabase
    .from('automations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('trigger_type', eventName)
    .limit(1)
  if (!activeAutos || activeAutos.length === 0) return

  let leadId: string | null = null
  if (conversationId) {
    const { data: conv } = await supabase.from('social_conversations').select('contato_id').eq('id', conversationId).maybeSingle()
    leadId = conv?.contato_id ?? null
  }
  if (!leadId) {
    leadId = await maybeCreateLead(supabase, orgId, inbound, connectionAccessToken)
    if (leadId && conversationId) {
      await supabase.from('social_conversations').update({ contato_id: leadId }).eq('id', conversationId)
    }
  }
  if (leadId) {
    await inngest.send({ name: eventName, data: { orgId, leadId, text: inbound.text } })
  }
}
