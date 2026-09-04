/**
 * Executes a single automation flow step (send_email/send_whatsapp/
 * create_task/move_stage/close_deal/add_tag/send_nps_survey/send_push/
 * webhook) and returns its outcome for logging.
 * Split out of lib/inngest/automation.ts — called from inside the durable
 * `step.run` in executeAutomationRun, so timing/outcome stay memoized
 * deterministically across Inngest replays.
 */

import { inngest } from './client'
import type { createAdminClient } from '../supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'
import { sendPushToOrg } from '@/actions/push'
import { resolveSystemSignedUrl } from '@/lib/storage/system'

export type StepExecutionResult = {
  status: 'success' | 'error'
  message: string | null
  stack: string | null
  sent: Record<string, any> | null
}

export async function executeAutomationStep(
  stepDef: { type: string; config: Record<string, any> },
  ctx: {
    supabase: ReturnType<typeof createAdminClient>
    orgId: string
    orgConfig: any
    lead: any
    auto: any
    triggerType?: string
  },
): Promise<StepExecutionResult> {
  const { supabase, orgId, orgConfig, lead, auto } = ctx
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
          // Resolve a mídia do cabeçalho fresca a partir do
          // template atual, nunca da URL congelada no config do
          // flow (headerMediaUrl fica salva ali só pra prévia
          // no editor — ver AutomationFlow.tsx — uma automação
          // roda indefinidamente, bem além do TTL de uma signed
          // URL). Sem header_storage_object_id (template
          // legado/URL manual), cai no headerMediaUrl do config
          // mesmo, igual sempre foi.
          let headerMediaUrl: string | undefined = stepDef.config.headerMediaUrl
          if (stepDef.config.headerType && stepDef.config.headerType !== 'none' && stepDef.config.headerType !== 'text') {
            const { data: tpl } = await supabase
              .from('whatsapp_templates')
              .select('header_storage_object_id')
              .eq('organization_id', orgId)
              .eq('name', stepDef.config.templateName)
              .maybeSingle()
            if (tpl?.header_storage_object_id) {
              headerMediaUrl = (await resolveSystemSignedUrl(tpl.header_storage_object_id)) ?? headerMediaUrl
            }
          }
          await sendTemplateMessage(
            orgConfig,
            lead.phone,
            stepDef.config.templateName,
            stepDef.config.variables || [],
            stepDef.config.language || 'pt_BR',
            stepDef.config.headerType,
            headerMediaUrl,
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
            status: 'open', // CHECK da coluna só aceita open|doing|done — 'todo' não existe, o insert falhava
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
      case 'close_deal': {
        // Fecha a negociação automaticamente — pensado pra ser
        // encadeado no gatilho "Lead parado" (lead.stale), que já
        // dispara com o prazo configurado em trigger_config.staleDays
        // (extensão do alerta existente, não um novo cron). Só age
        // sobre leads ainda abertos, pra não reabrir/duplicar efeito
        // em quem já foi fechado manualmente nesse meio-tempo.
        const dealStatus: 'perdido' | 'desqualificado' =
          stepDef.config.dealStatus === 'desqualificado' ? 'desqualificado' : 'perdido'
        const closeReason = stepDef.config.reason || 'Sem resposta (fechamento automático)'
        sent = { dealStatus, reason: closeReason }
        await supabase
          .from('contatos')
          .update({
            deal_status: dealStatus,
            close_reason: closeReason,
            closed_at: new Date().toISOString(),
            closed_by: null, // ação do sistema, não de um usuário
          })
          .eq('id', lead.id)
          .eq('organization_id', orgId)
          .eq('deal_status', 'aberto')
        await supabase.from('contato_activities').insert({
          contato_id: lead.id,
          organization_id: orgId,
          type: 'deal_closed',
          payload: { automation: auto.name, dealStatus, reason: closeReason },
        })
        break;
      }
      case 'add_tag':
        if (stepDef.config.tag) {
          sent = { tag: stepDef.config.tag }
          const newTags = Array.from(new Set([...(lead.tags || []), stepDef.config.tag]))
          await supabase.from('contatos').update({ tags: newTags }).eq('id', lead.id)
        }
        break;

      case 'send_nps_survey': {
        // Mesmo núcleo do disparo manual (actions/contatos-customers.ts
        // ::triggerNpsSurvey) — aqui rodando com o client admin, sem
        // sessão de usuário (contexto de cron/automação).
        const { sendNpsSurveyCore } = await import('@/lib/nps/send-survey')
        const res = await sendNpsSurveyCore(supabase, orgConfig, lead)
        sent = { phone: lead.phone }
        if (!res.ok) { status = 'error'; message = res.error }
        break;
      }

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
            icon:  '/logo-mark.png',
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
            event:   ctx.triggerType,
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

  return { status, message, stack, sent }
}
