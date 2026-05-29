import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'
import { sendPushToOrg } from '@/actions/push'

export const processAutomationEvent = inngest.createFunction(
  {
    id: 'automation-process',
    triggers: [
      { event: 'form.submitted' },
      { event: 'lead.stage_changed' },
      { event: 'lead.tag_added' },
      { event: 'task.overdue' },
      { event: 'lead.stale' },
      { event: 'appointment.booked' },
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
            lead_id: leadId,
            status: 'running',
            current_step: 0,
            started_at: new Date().toISOString(),
          }).select().single()

          if (run) {
            await inngest.send({
              name: 'automation.run.execute',
              data: { runId: run.id }
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
    ) {
      try {
        await supabase.from('automation_step_logs').insert({
          organization_id: orgId,
          automation_id:   auto.id,
          run_id:          runId,
          step_index:      stepIndex,
          step_type:       stepType,
          status,
          message: message ?? null,
        })
      } catch { /* ignore logging failures */ }
    }

    try {
      while (currentStep < steps.length) {
        const stepDef = steps[currentStep]
        let stepError: string | undefined

        try { await step.run(`execute-step-${currentStep}`, async () => {
          switch (stepDef.type) {
            case 'wait':
              // We don't sleep inside the run callback because run callbacks can't contain sleeps.
              // Instead we break out, but Inngest step.sleep is a special step.
              // Wait, if it's wait, we shouldn't do it inside `step.run`. We do it outside.
              break;
            case 'send_email':
              if (stepDef.config.templateId) {
                const { data: emailSend } = await supabase.from('email_sends').insert({
                  organization_id: orgId,
                  lead_id: lead.id,
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
                await supabase.from('tasks').insert({
                  organization_id: orgId,
                  lead_id: lead.id,
                  title: stepDef.config.title.replace('{{lead.name}}', lead.name),
                  status: 'todo',
                  priority: stepDef.config.priority || 'normal',
                  due_date: dueDate.toISOString()
                })
              }
              break;
            case 'move_stage':
              if (stepDef.config.stageId) {
                await supabase.from('leads').update({ stage_id: stepDef.config.stageId }).eq('id', lead.id)
                await supabase.from('lead_activities').insert({
                  lead_id: lead.id,
                  organization_id: orgId,
                  type: 'stage_changed',
                  payload: { automation: auto.name }
                })
              }
              break;
            case 'add_tag':
              if (stepDef.config.tag) {
                const newTags = Array.from(new Set([...(lead.tags || []), stepDef.config.tag]))
                await supabase.from('leads').update({ tags: newTags }).eq('id', lead.id)
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

                await sendPushToOrg(orgId, {
                  title: interpolate(stepDef.config.title),
                  body:  stepDef.config.body ? interpolate(stepDef.config.body) : lead.name || 'Lead atualizado',
                  url:   orgConfig?.slug ? `/app/${orgConfig.slug}/pipeline` : '/',
                  tag:   `automation-${auto.id}`,
                  icon:  '/icon.svg',
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
                let extraHeaders: Record<string, string> = {}
                if (stepDef.config.headers) {
                  try { extraHeaders = JSON.parse(stepDef.config.headers) } catch { /* ignore */ }
                }
                await fetch(stepDef.config.url, {
                  method:  stepDef.config.method || 'POST',
                  headers: { 'Content-Type': 'application/json', ...extraHeaders },
                  body:    JSON.stringify(payload),
                  signal:  AbortSignal.timeout(10_000),
                })
              }
              break;
            }
          }
        }) } catch (err: any) { stepError = err?.message || 'Unknown error' }

        // Log step outcome (skipped for 'wait' — it's a timing step, not an action).
        if (stepDef.type !== 'wait') {
          await step.run(`log-step-${currentStep}`, async () => {
            await logStep(currentStep, stepDef.type, stepError ? 'error' : 'success', stepError)
          })
        }

        if (stepDef.type === 'wait') {
          const { amount, unit } = stepDef.config
          let sleepDuration = `${amount}m`
          if (unit === 'hours') sleepDuration = `${amount}h`
          if (unit === 'days') sleepDuration = `${amount}d`
          await step.sleep(`wait-step-${currentStep}`, sleepDuration)
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
