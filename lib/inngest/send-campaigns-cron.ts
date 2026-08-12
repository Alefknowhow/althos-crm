/**
 * Cron das Campanhas de Envio (disparo em massa). A cada 2 minutos:
 *   1. Vira `scheduled -> sending` as campanhas com scheduled_at <= now()
 *      (cobre "enviar agora" também, já que scheduled_at fica null nesse caso).
 *   2. Pra cada campanha em `sending`, processa um lote de destinatários
 *      pendentes — cap conservador (40/tick ~= 1.200/hora) em relação ao
 *      nível mais baixo de mensageria da Meta, pra não derrubar a qualidade
 *      do número numa primeira campanha grande.
 *   3. Campanhas em massa NÃO tocam whatsapp_conversations/inbox — misturar
 *      milhares de envios de campanha com atendimento real enterraria
 *      conversas de verdade. A auditoria fica na tela de detalhe da campanha.
 *   4. Quando não sobra nenhuma linha pending/sending da campanha, marca
 *      completed.
 *
 * v1 só processa channel='whatsapp' — e-mail entra no Estágio 4.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'

const WHATSAPP_BATCH_PER_TICK = 40

export const sendCampaignsCronFn = inngest.createFunction(
  {
    id:       'send-campaigns',
    name:     'Campanhas de Envio: processa fila',
    retries:  1,
    triggers: [{ cron: '*/2 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const nowISO = new Date().toISOString()

    await step.run('activate-due-campaigns', async () => {
      await admin
        .from('send_campaigns')
        .update({ status: 'sending', started_at: nowISO })
        .eq('status', 'scheduled')
        .or(`scheduled_at.is.null,scheduled_at.lte.${nowISO}`)
    })

    const activeCampaigns: Array<{ id: string; organization_id: string; wa_template_name: string; wa_template_language: string; wa_header_type: string | null; wa_header_media_url: string | null }> =
      await step.run('fetch-active-whatsapp-campaigns', async () => {
        const { data } = await admin
          .from('send_campaigns')
          .select('id, organization_id, wa_template_name, wa_template_language, wa_header_type, wa_header_media_url')
          .eq('status', 'sending')
          .eq('channel', 'whatsapp')
        return data || []
      })

    let sent = 0
    let failed = 0

    for (const campaign of activeCampaigns) {
      const pending: Array<{ id: string; contact_phone: string | null }> = await step.run(`fetch-pending-${campaign.id}`, async () => {
        const { data } = await admin
          .from('send_campaign_recipients')
          .select('id, contact_phone')
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')
          .limit(WHATSAPP_BATCH_PER_TICK)
        return data || []
      })

      if (pending.length > 0) {
        const org: { whatsapp_phone_number_id: string | null; whatsapp_access_token: string | null } | null =
          await step.run(`fetch-org-config-${campaign.id}`, async () => {
            const { data } = await admin
              .from('organizations')
              .select('whatsapp_phone_number_id, whatsapp_access_token')
              .eq('id', campaign.organization_id)
              .maybeSingle()
            return data
          })

        for (const recipient of pending) {
          const claimed: boolean = await step.run(`claim-${recipient.id}`, async () => {
            const { data } = await admin
              .from('send_campaign_recipients')
              .update({ status: 'sending' })
              .eq('id', recipient.id)
              .eq('status', 'pending')
              .select('id')
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
                campaign.wa_header_media_url || undefined,
              )
              return { ok: true, messageId: res?.messages?.[0]?.id }
            } catch (e: any) {
              return { ok: false, error: e?.message || 'Erro ao enviar.' }
            }
          })

          await step.run(`finalize-${recipient.id}`, async () => {
            await admin
              .from('send_campaign_recipients')
              .update({
                status: result.ok ? 'sent' : 'failed',
                sent_at: result.ok ? new Date().toISOString() : null,
                meta_message_id: result.messageId || null,
                error: result.ok ? null : result.error,
              })
              .eq('id', recipient.id)
          })

          if (result.ok) sent++
          else failed++
        }

        await step.run(`bump-counts-${campaign.id}`, async () => {
          const { count: sentCount } = await admin
            .from('send_campaign_recipients')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'sent')
          const { count: failedCount } = await admin
            .from('send_campaign_recipients')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'failed')
          await admin
            .from('send_campaigns')
            .update({ sent_count: sentCount || 0, failed_count: failedCount || 0 })
            .eq('id', campaign.id)
        })
      }

      await step.run(`maybe-complete-${campaign.id}`, async () => {
        const { count: remaining } = await admin
          .from('send_campaign_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .in('status', ['pending', 'sending'])
        if (!remaining) {
          await admin
            .from('send_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaign.id)
        }
      })
    }

    return { sent, failed }
  }
)
