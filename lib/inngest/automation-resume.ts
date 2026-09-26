import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { getNextAutomationStepId, type AutomationFlow } from '../automations/automation-traversal'

/**
 * Retoma um automation_run pausado num `wait_for_reply` assim que a resposta
 * do lead chega (DM/comentário do Instagram — chamado por
 * lib/social/engine.ts, mesmo papel que runFunnelForInbound cumpre pro
 * motor de funil antigo). Resolve o próximo step pelo grafo da automação
 * (texto/botão da resposta) e reenfileira a execução.
 *
 * Extraído de automation.ts (que passou do limite de 350 linhas de arquivo).
 */
export async function resumeWaitingAutomationRun(
  supabase: ReturnType<typeof createAdminClient>,
  run: { id: string; organization_id: string; waiting_for_step_id: string | null },
  auto: { steps: any[]; flow?: AutomationFlow },
  reply: { replyText: string; matchedButtonIndex: number | null },
): Promise<void> {
  if (!run.waiting_for_step_id) return
  const steps = auto.steps || []
  const fallbackOrder = steps.map((s: any) => s.id)
  const nextId = getNextAutomationStepId(auto.flow, run.waiting_for_step_id, {
    replyText: reply.replyText,
    matchedButtonIndex: reply.matchedButtonIndex,
    fallbackOrder,
  })
  await supabase.from('automation_runs').update({
    status: 'running',
    current_step_id: nextId,
    waiting_for_step_id: null,
  }).eq('id', run.id)
  await inngest.send({ name: 'automation.run.execute', data: { runId: run.id, orgId: run.organization_id } })
}
