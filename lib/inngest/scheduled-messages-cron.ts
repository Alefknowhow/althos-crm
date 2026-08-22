/**
 * Per-minute cron that delivers due scheduled WhatsApp messages.
 *
 * Each tick:
 *   1. Pulls pending rows whose send_at has passed.
 *   2. Atomically claims each (pending -> sending) so overlapping ticks don't
 *      double-send.
 *   3. Delivers via lib/whatsapp/scheduled-delivery (24h window + template
 *      fallback). That helper writes the final 'sent'/'failed' status.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { deliverScheduledMessage, type ScheduledRow } from '@/lib/whatsapp/scheduled-delivery'

export const scheduledWhatsappMessagesFn = inngest.createFunction(
  {
    id:       'scheduled-whatsapp-messages',
    name:     'WhatsApp: envios agendados',
    retries:  1,
    // Era a cada 1 min (1.440 execuções/dia mesmo sem nada agendado) — 3 min
    // é imperceptível pra quem agenda uma mensagem e corta o volume base em
    // 2/3 (ver auditoria de custo Inngest, 2026-08-22).
    triggers: [{ cron: '*/3 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const nowISO = new Date().toISOString()

    const due: ScheduledRow[] = await step.run('fetch-due-scheduled', async () => {
      const { data } = await admin
        .from('scheduled_whatsapp_messages')
        .select('id, organization_id, conversation_id, contato_id, contact_phone, body, fallback_template_id, fallback_variables')
        .eq('status', 'pending')
        .lte('send_at', nowISO)
        .order('send_at', { ascending: true })
        .limit(50)
      return data || []
    })

    if (due.length === 0) return { delivered: 0, failed: 0 }

    let delivered = 0
    let failed = 0

    for (const row of due) {
      // Claim it: only proceed if we flip pending -> sending. The conditional
      // .eq('status','pending') makes this a no-op if another tick won the race.
      const claimed: boolean = await step.run(`claim-${row.id}`, async () => {
        const { data } = await admin
          .from('scheduled_whatsapp_messages')
          .update({ status: 'sending' })
          .eq('id', row.id)
          .eq('status', 'pending')
          .select('id')
        return !!(data && data.length > 0)
      })

      if (!claimed) continue

      const res = await step.run(`deliver-${row.id}`, async () => {
        return deliverScheduledMessage(admin, row)
      })

      if (res.ok) delivered++
      else failed++
    }

    return { delivered, failed }
  }
)
