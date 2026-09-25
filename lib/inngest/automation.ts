import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { executeAutomationStep } from './automation-step-executor'
import { getNextAutomationStepId, type AutomationFlow } from '../automations/automation-traversal'
import { runAutomationGraph } from './automation-run-graph'
import { evaluateConditionGroups } from '../automations/condition-fields'

// Inngest limita 10 triggers por function — com Core + Clínicas + Imóveis +
// Seguros a lista passou de 10, então o processamento (mesmo corpo,
// compartilhado) foi dividido em 2 functions só pra caber no limite. Ao
// adicionar um evento de automação novo, coloque na function com espaço
// sobrando (a de menos triggers) em vez de sempre na primeira.
async function handleAutomationEvent({ event, step }: { event: any; step: any }) {
  const supabase = createAdminClient()
  const { orgId, leadId, formId, stageId, tag } = event.data as {
    orgId:    string
    leadId:   string | undefined
    formId?:  string
    stageId?: string
    tag?:     string
  }

  // Some triggers don't have a leadId — skip those.
  if (!leadId) return { matched: 0 }

  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('trigger_type', event.name)

  if (!automations || automations.length === 0) return { matched: 0 }

  let matchedCount = 0

  for (const auto of automations) {
    let isMatch = true
    if (event.name === 'form.submitted' && auto.trigger_config.formId) {
      if (auto.trigger_config.formId !== formId) isMatch = false
    }
    if (event.name === 'lead.stage_changed' && auto.trigger_config.stageId) {
      if (auto.trigger_config.stageId !== stageId) isMatch = false
    }
    if (event.name === 'lead.tag_added' && auto.trigger_config.tag) {
      if (auto.trigger_config.tag !== tag) isMatch = false
    }
    if ((event.name === 'instagram.dm.received' || event.name === 'instagram.comment.received') && auto.trigger_config.keyword) {
      const text = String((event.data as any)?.text || '').toLowerCase()
      if (!text.includes(auto.trigger_config.keyword.toLowerCase())) isMatch = false
    }
    // task.overdue, lead.stale, appointment.booked: no extra filter needed at this layer

    if (isMatch) {
      matchedCount++
      await step.run(`create-run-${auto.id}`, async () => {
        const { data: run, error } = await supabase.from('automation_runs').insert({
          organization_id: orgId,
          automation_id: auto.id,
          automation_version_id: auto.current_version_id ?? null,
          contato_id: leadId,
          status: 'running',
          current_step: 0,
          started_at: new Date().toISOString(),
          trigger_payload: event.data ?? {},
        }).select().single()

        if (error || !run) {
          throw new Error(`Falha ao criar automation_run para automation ${auto.id}: ${error?.message}`)
        }

        await inngest.send({
          name: 'automation.run.execute',
          data: { runId: run.id, orgId }
        })
      })
    }
  }

  return { matched: matchedCount }
}

export const processAutomationEvent = inngest.createFunction(
  {
    id: 'automation-process',
    // Isola tenants: no máximo 5 processamentos simultâneos por organização,
    // para que um cliente com muitos leads não engula a fila dos outros.
    concurrency: { key: 'event.data.orgId', limit: 5 },
    triggers: [
      { event: 'form.submitted' },
      { event: 'lead.stage_changed' },
      { event: 'lead.tag_added' },
      { event: 'task.overdue' },
      { event: 'lead.stale' },
      { event: 'appointment.booked' },
      { event: 'customer.birthday' },
      // Vertical Clínicas — eventos de ciclo de vida (Fase 12), mesmo
      // motor de automação genérico do Core, sem engine paralela.
      { event: 'clinic.appointment.confirmed' },
      { event: 'clinic.quote.approved' },
      { event: 'clinic.attendance.completed' },
    ]
  },
  handleAutomationEvent,
)

export const processAutomationEventVerticals = inngest.createFunction(
  {
    id: 'automation-process-verticals',
    concurrency: { key: 'event.data.orgId', limit: 5 },
    triggers: [
      // Vertical Imobiliárias — ciclo de vida de visitas (Fase 2), mesmo
      // motor genérico, sem engine paralela.
      { event: 'imoveis.visit.scheduled' },
      { event: 'imoveis.visit.confirmed' },
      { event: 'imoveis.visit.canceled' },
      { event: 'imoveis.visit.completed' },
      { event: 'imoveis.proposal.sent' },
      { event: 'imoveis.deal.closed' },
      // Vertical Seguros — ciclo de vida de apólices (Fase 3), mesmo
      // motor genérico, sem engine paralela.
      { event: 'seguros.policy.issued' },
      { event: 'seguros.policy.renewal_due' },
      { event: 'seguros.claim.opened' },
      // Genérico (Core) — cabe aqui só porque a outra function já está no
      // teto de 10 triggers do Inngest, não por afinidade com verticais.
      { event: 'customer.converted' },
    ]
  },
  handleAutomationEvent,
)

export const processAutomationEventVerticals2 = inngest.createFunction(
  {
    id: 'automation-process-verticals-2',
    concurrency: { key: 'event.data.orgId', limit: 5 },
    triggers: [
      // Genérico (venda) + Agências de Viagem (reserva/embarque) + Clínicas
      // (atendimento registrado) — cabem aqui só porque as outras 2 functions
      // já estão no teto de 10 triggers do Inngest, não por afinidade entre si.
      { event: 'sale.registered' },
      { event: 'viagens.reserva.created' },
      { event: 'viagens.embarque.scheduled' },
      { event: 'clinicas.atendimento.registered' },
      // Althos Voice — chamada concluída/qualificada pela IA e SMS recebido.
      { event: 'voice.call.completed' },
      { event: 'voice.ai.qualified' },
      { event: 'sms.received' },
      // Instagram — motor genérico (fusão com os funis de DM, Fase 3).
      { event: 'instagram.dm.received' },
      { event: 'instagram.comment.received' },
    ]
  },
  handleAutomationEvent,
)

export const executeAutomationRun = inngest.createFunction(
  {
    id: 'automation-run-execute',
    // Mesmo isolamento por org na execução do run. Garante que envios de
    // WhatsApp/Email de um tenant não estourem o ritmo dos demais.
    concurrency: { key: 'event.data.orgId', limit: 5 },
    triggers: [{ event: 'automation.run.execute' }]
  },
  async ({ event, step }) => {
    const { runId } = event.data
    const supabase = createAdminClient()

    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .select('*, automations(*), contatos(*), organizations(*), automation_versions(steps, flow)')
      .eq('id', runId)
      .maybeSingle()

    if (runError) throw new Error(`Falha ao carregar automation_run ${runId}: ${runError.message}`)
    if (!run || run.status !== 'running') return

    const { automations: auto, contatos: lead, organizations: orgConfig, organization_id: orgId } = run as any
    if (!auto || !lead) return

    // Versionamento (issue #18 §18): se o run tem uma versão pinada, executa
    // A DEFINIÇÃO CONGELADA daquele momento — editar a automação enquanto o
    // run está em andamento não muda o que ele executa. Sem versão (runs
    // criados antes desta migration), cai no live `automations.steps/flow`.
    const pinnedVersion = (run as any).automation_versions
    const steps = pinnedVersion?.steps ?? auto.steps ?? []
    const flow: AutomationFlow | undefined = pinnedVersion?.flow ?? auto.flow

    // Helper: write a row to automation_step_logs (best-effort, never throws).
    async function logStep(
      stepIndex: number,
      stepType: string,
      status: 'success' | 'error' | 'skipped',
      message?: string,
      timing?: {
        startedAt?: string
        completedAt?: string
        durationMs?: number
        metadata?: Record<string, any>
      },
    ) {
      try {
        await supabase.from('automation_step_logs').insert({
          organization_id: orgId,
          automation_id:   auto.id,
          run_id:          runId,
          step_index:      stepIndex,
          step_type:       stepType,
          status,
          message:         message ?? null,
          started_at:      timing?.startedAt ?? null,
          completed_at:    timing?.completedAt ?? null,
          duration_ms:     timing?.durationMs ?? null,
          metadata_json:   timing?.metadata ?? {},
        })
      } catch { /* ignore logging failures */ }
    }

    // Automação com `flow` (grafo, ex.: ramificação por resposta) usa
    // travessia por id de step (automation-traversal.ts) — pode pausar
    // num `wait_for_reply` e ser retomada depois por resumeWaitingAutomationRun.
    // Sem `flow`, cai no array `steps` linear de sempre (comportamento
    // idêntico ao de antes da Fase 3, nenhuma automação existente muda).
    if (flow) {
      await runAutomationGraph({ step, supabase, runId, run, auto: { ...auto, steps, flow }, orgId, orgConfig, lead, flow, logStep })
      return
    }

    let currentStep = run.current_step

    try {
      while (currentStep < steps.length) {
        const stepDef = steps[currentStep]

        if (stepDef.type === 'wait') {
          // 'wait' is a timing step (not an action): never logged, just sleeps.
          // step.sleep is a special Inngest step and cannot live inside step.run.
          const { amount, unit } = stepDef.config
          let sleepDuration = `${amount}m`
          if (unit === 'hours') sleepDuration = `${amount}h`
          if (unit === 'days') sleepDuration = `${amount}d`
          await step.sleep(`wait-step-${currentStep}`, sleepDuration)
        } else if (stepDef.type === 'condition') {
          // Sem `flow` não há pra onde ramificar — uma condição falsa aqui só
          // encerra o run (os passos seguintes do array nunca rodam).
          const result = evaluateConditionGroups(stepDef.config?.groups, lead)
          await step.run(`log-step-${currentStep}`, async () => {
            await logStep(currentStep, 'condition', 'success', result ? 'Condição atendida' : 'Condição não atendida — run encerrado')
          })
          if (!result) break
        } else {
          // Execute the action. Timing + outcome are computed INSIDE the durable
          // step so they're memoized deterministically across Inngest replays.
          // `sent` captures the "payload enviado" for the logs timeline.
          const result = await step.run(`execute-step-${currentStep}`, async () => {
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

          await step.run(`log-step-${currentStep}`, async () => {
            await logStep(currentStep, stepDef.type, result.status, result.message ?? undefined, {
              startedAt:   result.startedAt,
              completedAt: result.completedAt,
              durationMs:  result.durationMs,
              metadata:    { payload: result.sent, stack: result.stack },
            })
          })
        }

        currentStep++

        await step.run(`update-run-${currentStep}`, async () => {
          await supabase.from('automation_runs').update({ current_step: currentStep }).eq('id', runId)
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
)

/**
 * Retoma um automation_run pausado num `wait_for_reply` assim que a resposta
 * do lead chega (DM/comentário do Instagram — chamado por
 * lib/social/engine.ts, mesmo papel que runFunnelForInbound cumpre pro
 * motor de funil antigo). Resolve o próximo step pelo grafo da automação
 * (texto/botão da resposta) e reenfileira a execução.
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
