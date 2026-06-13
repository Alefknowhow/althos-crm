import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'
import { sendPushToOrg } from '@/actions/push'

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
    ]
  },
  async ({ event, step }: { event: any; step: any }) => {
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
      // task.overdue, lead.stale, appointment.booked: no extra filter needed at this layer

      if (isMatch) {
        matchedCount++
        await step.run(`create-run-${auto.id}`, async () => {
          const { data: run } = await supabase.from('automation_runs').insert({
            organization_id: orgId,
            automation_id: auto.id,
            contato_id: leadId,
            status: 'running',
            current_step: 0,
            started_at: new Date().toISOString(),
            trigger_payload: event.data ?? {},
          }).select().single()

          if (run) {
            await inngest.send({
              name: 'automation.run.execute',
              data: { runId: run.id, orgId }
            })
          }
        })
      }
    }

    return { matched: matchedCount }
  }
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

    const { data: run } = await supabase
      .from('automation_runs')
      .select('*, automations(*), leads(*), organizations(*)')
      .eq('id', runId)
      .maybeSingle()

    if (!run || run.status !== 'running') return

    const { automations: auto, leads: lead, organizations: orgConfig, organization_id: orgId } = run as any
    if (!auto || !lead) return

    let currentStep = run.current_step
    const steps = auto.steps || []

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
        } else {
          // Execute the action. Timing + outcome are computed INSIDE the durable
          // step so they're memoized deterministically across Inngest replays.
          // `sent` captures the "payload enviado" for the logs timeline.
          const result = await step.run(`execute-step-${currentStep}`, async () => {
            const startedAt = new Date().toISOString()
            let status: 'success' | 'error' = 'success'
            let message: string | null = null
            let stack: string | null = null
            let sent: Record<string, any> | null = null

            try {
              switch (stepDef.type) {
                case 'send_email':
                  if (stepDef.config.templateId) {
                    sent = { to: lead.email, templateId: stepDef.config.templateId }
                    const { data: emailSend } = await supabase.from('email_sends').insert({
                      organization_id: orgId,
                      contato_id: lead.id,
                      template_id: stepDef.config.templateId,
                      to_email: lead.email,
                      status: 'pending'
                    }).select().single()

                    if (emailSend) {
                      await inngest.send({
                        name: 'email.send',
                        data: { emailSendId: emailSend.id }
                      })
                    }
                  }
                  break;
                case 'send_whatsapp':
                  if (stepDef.config.templateName && lead.phone && orgConfig) {
                    sent = {
                      to: lead.phone,
                      template: stepDef.config.templateName,
                      language: stepDef.config.language || 'pt_BR',
                    }
                    await sendTemplateMessage(
                      orgConfig,
                      lead.phone,
                      stepDef.config.templateName,
                      stepDef.config.variables || [],
                      stepDef.config.language || 'pt_BR',
                      stepDef.config.headerType,
                      stepDef.config.headerMediaUrl,
                    )
                  }
                  break;
                case 'create_task':
                  if (stepDef.config.title) {
                    const dueDate = new Date()
                    dueDate.setDate(dueDate.getDate() + (stepDef.config.dueInDays || 1))
                    const title = stepDef.config.title.replace('{{lead.name}}', lead.name)
                    sent = { title, dueDate: dueDate.toISOString(), priority: stepDef.config.priority || 'normal' }
                    await supabase.from('tasks').insert({
                      organization_id: orgId,
                      contato_id: lead.id,
                      title,
                      status: 'todo',
                      priority: stepDef.config.priority || 'normal',
                      due_date: dueDate.toISOString()
                    })
                  }
                  break;
                case 'move_stage':
                  if (stepDef.config.stageId) {
                    sent = { stageId: stepDef.config.stageId }
                    await supabase.from('contatos').update({ stage_id: stepDef.config.stageId }).eq('id', lead.id)
                    await supabase.from('contato_activities').insert({
                      contato_id: lead.id,
                      organization_id: orgId,
                      type: 'stage_changed',
                      payload: { automation: auto.name }
                    })
                  }
                  break;
                case 'add_tag':
                  if (stepDef.config.tag) {
                    sent = { tag: stepDef.config.tag }
                    const newTags = Array.from(new Set([...(lead.tags || []), stepDef.config.tag]))
                    await supabase.from('contatos').update({ tags: newTags }).eq('id', lead.id)
                  }
                  break;

                case 'send_push': {
                  if (stepDef.config.title) {
                    // Interpolate {{lead.*}} variables in title + body
                    const interpolate = (template: string): string =>
                      template
                        .replace(/\{\{lead\.name\}\}/g,  lead.name  || '')
                        .replace(/\{\{lead\.email\}\}/g, lead.email || '')
                        .replace(/\{\{lead\.phone\}\}/g, lead.phone || '')

                    const pushTitle = interpolate(stepDef.config.title)
                    const pushBody = stepDef.config.body ? interpolate(stepDef.config.body) : lead.name || 'Lead atualizado'
                    const pushUrl = orgConfig?.slug ? `/app/${orgConfig.slug}/pipeline` : '/'
                    sent = { title: pushTitle }
                    await sendPushToOrg(orgId, {
                      title: pushTitle,
                      body:  pushBody,
                      url:   pushUrl,
                      tag:   `automation-${auto.id}`,
                      icon:  '/icon.svg',
                    })
                    const { createNotification } = await import('@/actions/notifications')
                    await createNotification({
                      organizationId: orgId,
                      type: 'automation',
                      title: pushTitle,
                      content: pushBody,
                      link: pushUrl,
                    })
                  }
                  break;
                }

                case 'webhook': {
                  if (stepDef.config.url) {
                    const payload = {
                      event:   run.automations?.trigger_type,
                      lead: {
                        id:    lead.id,
                        name:  lead.name,
                        email: lead.email,
                        phone: lead.phone,
                        tags:  lead.tags,
                      },
                      automation: {
                        id:   auto.id,
                        name: auto.name,
                      },
                      fired_at: new Date().toISOString(),
                    }
                    sent = { url: stepDef.config.url, method: stepDef.config.method || 'POST' }
                    let extraHeaders: Record<string, string> = {}
                    if (stepDef.config.headers) {
                      try { extraHeaders = JSON.parse(stepDef.config.headers) } catch { /* ignore */ }
                    }
                    const resp = await fetch(stepDef.config.url, {
                      method:  stepDef.config.method || 'POST',
                      headers: { 'Content-Type': 'application/json', ...extraHeaders },
                      body:    JSON.stringify(payload),
                      signal:  AbortSignal.timeout(10_000),
                    })
                    sent = { ...sent, responseStatus: resp.status }
                    if (!resp.ok) throw new Error(`Webhook respondeu ${resp.status}`)
                  }
                  break;
                }
              }
            } catch (err: any) {
              status = 'error'
              message = err?.message || 'Unknown error'
              stack = err?.stack || null
            }

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
