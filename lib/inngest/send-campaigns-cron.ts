/**
 * Campanhas de Envio (disparo em massa) — orientado a evento, não a
 * polling (2026-08-22, economia de custo Inngest). Era uma cron rodando a
 * cada 2-5 min o dia inteiro (centenas de execuções/dia mesmo sem nenhuma
 * campanha ativa); agora é 1 execução por campanha, do início ao fim.
 *
 * Disparo: actions/send-campaigns.ts::materializeAndScheduleCampaign manda
 * o evento `campaign/send.requested` depois de materializar os
 * destinatários. resendFailedRecipient manda de novo pra reativar uma
 * campanha já 'completed' quando o usuário reenvia um item falho.
 *
 * Uma única execução, do início ao fim:
 *   1. Se `scheduled_at` é no futuro, `step.sleepUntil` até lá (sem
 *      consumir cota — sleep é de graça no Inngest, só volta a rodar
 *      quando chega a hora).
 *   2. Processa em lotes com `step.sleep` entre eles pra respeitar o
 *      limite de mensageria da Meta — MESMA pausa de 90s entre lotes de 40
 *      que a cron de 2min tinha, só que sem ficar recriando a execução do
 *      zero a cada tick.
 *   3. Marca `completed` quando não sobra nenhum pending/sending.
 *
 * `concurrency` por campaignId evita 2 disparos da mesma campanha rodando
 * ao mesmo tempo (ex.: reenvio manual enquanto o envio original ainda não
 * terminou).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'
import { getResend, clientEmailFrom } from '@/lib/resend'
import { renderTemplate } from '@/lib/inngest/functions'
import { resolveSystemSignedUrl } from '@/lib/storage/system'

const WHATSAPP_BATCH = 40
const EMAIL_BATCH = 100
const WHATSAPP_PACE = '90 seconds' // ~1.200/hora, mesmo teto conservador de antes

export const sendCampaignFn = inngest.createFunction(
  {
    id:      'send-campaign',
    name:    'Campanhas de Envio: processa uma campanha',
    retries: 2,
    concurrency: { key: 'event.data.campaignId', limit: 1 },
    triggers: [{ event: 'campaign/send.requested' }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { campaignId } = event.data as { campaignId: string }
    const admin = createAdminClient()

    const campaign: any = await step.run('fetch-campaign', async () => {
      const { data } = await admin.from('send_campaigns').select('*').eq('id', campaignId).maybeSingle()
      return data
    })
    if (!campaign || campaign.status === 'canceled' || campaign.status === 'draft') {
      return { skipped: campaign?.status || 'not_found' }
    }

    if (campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now()) {
      await step.sleepUntil('wait-for-schedule', campaign.scheduled_at)
    }

    await step.run('mark-sending', async () => {
      await admin.from('send_campaigns').update({ status: 'sending', started_at: new Date().toISOString() }).eq('id', campaignId).neq('status', 'canceled')
    })

    let sent = 0
    let failed = 0
    let batchIndex = 0

    if (campaign.channel === 'whatsapp') {
      const headerMediaUrl: string | undefined = campaign.wa_header_storage_object_id
        ? (await step.run('resolve-header-media', () => resolveSystemSignedUrl(campaign.wa_header_storage_object_id))) ?? undefined
        : campaign.wa_header_media_url || undefined

      while (true) {
        const pending: Array<{ id: string; contact_phone: string | null }> = await step.run(`fetch-pending-${batchIndex}`, async () => {
          const canceled = await admin.from('send_campaigns').select('status').eq('id', campaignId).maybeSingle()
          if (canceled.data?.status === 'canceled') return []
          const { data } = await admin
            .from('send_campaign_recipients')
            .select('id, contact_phone')
            .eq('campaign_id', campaignId)
            .eq('status', 'pending')
            .limit(WHATSAPP_BATCH)
          return data || []
        })
        if (pending.length === 0) break

        const org: any = await step.run(`fetch-org-config-${batchIndex}`, async () => {
          const { data } = await admin
            .from('organizations')
            .select('whatsapp_phone_number_id, whatsapp_access_token')
            .eq('id', campaign.organization_id)
            .maybeSingle()
          return data
        })

        for (const recipient of pending) {
          const claimed: boolean = await step.run(`claim-${recipient.id}`, async () => {
            const { data } = await admin.from('send_campaign_recipients').update({ status: 'sending' }).eq('id', recipient.id).eq('status', 'pending').select('id')
            return !!(data && data.length > 0)
          })
          if (!claimed) continue

          const result: { ok: boolean; messageId?: string; error?: string } = await step.run(`send-${recipient.id}`, async () => {
            if (!recipient.contact_phone) return { ok: false, error: 'Contato sem telefone.' }
            try {
              const res = await sendTemplateMessage(
                org || {},
                recipient.contact_phone,
                campaign.wa_template_name,
                [],
                campaign.wa_template_language || 'pt_BR',
                campaign.wa_header_type || undefined,
                headerMediaUrl,
              )
              return { ok: true, messageId: res?.messages?.[0]?.id }
            } catch (e: any) {
              return { ok: false, error: e?.message || 'Erro ao enviar.' }
            }
          })

          await step.run(`finalize-${recipient.id}`, async () => {
            await admin.from('send_campaign_recipients').update({
              status: result.ok ? 'sent' : 'failed',
              sent_at: result.ok ? new Date().toISOString() : null,
              meta_message_id: result.messageId || null,
              error: result.ok ? null : result.error,
            }).eq('id', recipient.id)
          })

          if (result.ok) sent++
          else failed++
        }

        batchIndex++
        await step.sleep(`pace-${batchIndex}`, WHATSAPP_PACE)
      }
    } else {
      while (true) {
        const pending: Array<{ id: string; contact_name: string | null; contact_email: string | null }> = await step.run(`fetch-pending-email-${batchIndex}`, async () => {
          const canceled = await admin.from('send_campaigns').select('status').eq('id', campaignId).maybeSingle()
          if (canceled.data?.status === 'canceled') return []
          const { data } = await admin
            .from('send_campaign_recipients')
            .select('id, contact_name, contact_email')
            .eq('campaign_id', campaignId)
            .eq('status', 'pending')
            .limit(EMAIL_BATCH)
          return data || []
        })
        if (pending.length === 0) break

        const [org, template]: [any, any] = await step.run(`fetch-email-context-${batchIndex}`, async () => {
          const [orgRes, templateRes] = await Promise.all([
            admin.from('organizations').select('name').eq('id', campaign.organization_id).maybeSingle(),
            campaign.email_template_id
              ? admin.from('email_templates').select('subject, body_html').eq('id', campaign.email_template_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ])
          return [orgRes.data, templateRes.data]
        })

        for (const recipient of pending) {
          const claimed: boolean = await step.run(`claim-email-${recipient.id}`, async () => {
            const { data } = await admin.from('send_campaign_recipients').update({ status: 'sending' }).eq('id', recipient.id).eq('status', 'pending').select('id')
            return !!(data && data.length > 0)
          })
          if (!claimed) continue

          const result: { ok: boolean; id?: string; error?: string } = await step.run(`send-email-${recipient.id}`, async () => {
            if (!recipient.contact_email) return { ok: false, error: 'Contato sem e-mail.' }
            if (!template) return { ok: false, error: 'Template de e-mail não encontrado.' }
            try {
              const variables = { lead: { name: recipient.contact_name || '' }, org: { name: org?.name || '' } }
              const subject = renderTemplate(template.subject || '', variables)
              const html = renderTemplate(template.body_html || '', variables)
              const { data, error } = await getResend().emails.send({ from: clientEmailFrom(org?.name), to: recipient.contact_email, subject, html })
              if (error) throw error
              return { ok: true, id: data?.id }
            } catch (e: any) {
              return { ok: false, error: e?.message || 'Erro ao enviar.' }
            }
          })

          await step.run(`finalize-email-${recipient.id}`, async () => {
            await admin.from('send_campaign_recipients').update({
              status: result.ok ? 'sent' : 'failed',
              sent_at: result.ok ? new Date().toISOString() : null,
              resend_id: result.id || null,
              error: result.ok ? null : result.error,
            }).eq('id', recipient.id)
          })

          if (result.ok) sent++
          else failed++
        }

        batchIndex++
        // E-mail não tem o mesmo limite de mensageria do WhatsApp — pausa curta só
        // pra não martelar o Resend em loop apertado.
        await step.sleep(`pace-email-${batchIndex}`, '10 seconds')
      }
    }

    await step.run('bump-counts', async () => {
      const { count: sentCount } = await admin.from('send_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'sent')
      const { count: failedCount } = await admin.from('send_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed')
      await admin.from('send_campaigns').update({ sent_count: sentCount || 0, failed_count: failedCount || 0 }).eq('id', campaignId)
    })

    await step.run('maybe-complete', async () => {
      const { count: remaining } = await admin.from('send_campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('status', ['pending', 'sending'])
      if (!remaining) {
        await admin.from('send_campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', campaignId).neq('status', 'canceled')
      }
    })

    return { sent, failed }
  },
)
