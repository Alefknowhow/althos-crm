/**
 * Execução de um automation_run em modo grafo (`automation.flow` presente)
 * — travessia por id de step (automation-traversal.ts), pode pausar num
 * `wait_for_reply` e ser retomada depois por resumeWaitingAutomationRun.
 * Extraído de lib/inngest/automation.ts só por tamanho de arquivo (limite
 * de 350 linhas do projeto) — chamado de dentro de executeAutomationRun,
 * mesma function/step do Inngest, sem mudança de comportamento.
 *
 * Sem `flow`, executeAutomationRun nem chama este módulo — cai no array
 * `steps` linear de sempre (nenhuma automação existente muda).
 */

import type { createAdminClient } from '../supabase/server'
import { executeAutomationStep } from './automation-step-executor'
import { getFirstAutomationStepId, getNextAutomationStepId, type AutomationFlow } from '../automations/automation-traversal'

type LogStep = (
  stepIndex: number,
  stepType: string,
  status: 'success' | 'error' | 'skipped',
  message?: string,
  timing?: { startedAt?: string; completedAt?: string; durationMs?: number; metadata?: Record<string, any> },
) => Promise<void>

export async function runAutomationGraph(ctx: {
  step: any
  supabase: ReturnType<typeof createAdminClient>
  runId: string
  run: { current_step_id: string | null; automations?: { trigger_type?: string } }
  auto: { id: string; steps: any[]; flow?: AutomationFlow }
  orgId: string
  orgConfig: any
  lead: any
  flow: AutomationFlow
  logStep: LogStep
}): Promise<void> {
  const { step, supabase, runId, run, auto, orgId, orgConfig, lead, flow, logStep } = ctx
  const steps = auto.steps || []
  const stepsById = new Map<string, any>(steps.map((s: any) => [s.id, s]))
  const fallbackOrder = steps.map((s: any) => s.id)
  let currentId: string | null = run.current_step_id ?? getFirstAutomationStepId(flow, fallbackOrder)

  try {
    while (currentId && currentId !== 'end') {
      const stepDef = stepsById.get(currentId)
      if (!stepDef) break // edge órfã (step apagado) — encerra o run em vez de travar
      const stepIndex = fallbackOrder.indexOf(currentId)

      if (stepDef.type === 'wait') {
        const { amount, unit } = stepDef.config
        let sleepDuration = `${amount}m`
        if (unit === 'hours') sleepDuration = `${amount}h`
        if (unit === 'days') sleepDuration = `${amount}d`
        await step.sleep(`wait-step-${currentId}`, sleepDuration)
        currentId = getNextAutomationStepId(flow, currentId, { replyText: '', matchedButtonIndex: null, fallbackOrder })
        await step.run(`advance-run-${currentId}`, async () => {
          await supabase.from('automation_runs').update({ current_step_id: currentId }).eq('id', runId)
        })
        continue
      }

      if (stepDef.type === 'wait_for_reply') {
        await step.run(`pause-run-${currentId}`, async () => {
          await supabase.from('automation_runs').update({ status: 'waiting', current_step_id: currentId, waiting_for_step_id: currentId }).eq('id', runId)
        })
        return
      }

      const result = await step.run(`execute-step-${currentId}`, async () => {
        const startedAt = new Date().toISOString()
        const { status, message, stack, sent } = await executeAutomationStep(stepDef, {
          supabase, orgId, orgConfig, lead, auto, triggerType: run.automations?.trigger_type,
        })
        const completedAt = new Date().toISOString()
        return {
          startedAt,
          completedAt,
          durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
          status,
          message,
          stack,
          sent,
        }
      })

      await step.run(`log-step-${currentId}`, async () => {
        await logStep(stepIndex, stepDef.type, result.status, result.message ?? undefined, {
          startedAt:   result.startedAt,
          completedAt: result.completedAt,
          durationMs:  result.durationMs,
          metadata:    { payload: result.sent, stack: result.stack },
        })
      })

      currentId = getNextAutomationStepId(flow, currentId, { replyText: '', matchedButtonIndex: null, fallbackOrder })
      await step.run(`advance-run-${currentId}`, async () => {
        await supabase.from('automation_runs').update({ current_step_id: currentId }).eq('id', runId)
      })
    }

    await step.run('complete-run', async () => {
      await supabase.from('automation_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', runId)
    })
  } catch (err: any) {
    await step.run('fail-run', async () => {
      await supabase.from('automation_runs').update({
        status: 'failed',
        error: err.message
      }).eq('id', runId)
    })
  }
}
