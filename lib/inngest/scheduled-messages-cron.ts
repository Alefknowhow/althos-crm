/**
 * Entrega de mensagens agendadas do WhatsApp — orientado a evento, não a
 * polling. Era uma cron rodando a cada 1-3 min o dia inteiro (centenas de
 * execuções/dia mesmo sem nada agendado); agora é 1 execução por mensagem
 * agendada, que "dorme" (`step.sleepUntil`) exatamente até o horário de
 * envio em vez de o sistema inteiro ficar checando de tempos em tempos.
 *
 * Disparo: actions/whatsapp.ts::scheduleWhatsappMessage manda o evento
 * `whatsapp/message.scheduled` logo depois de inserir a linha.
 *
 * Cancelamento: cancelScheduledMessage só troca status pra 'canceled'
 * enquanto ainda 'pending' — quando esta function acorda, o passo `claim`
 * (update condicional .eq('status','pending')) simplesmente não encontra
 * a linha e sai sem fazer nada. Não precisa cancelar o evento.
 *
 * Rede de segurança: scheduledMessagesReconcileFn roda 1x/dia (custo
 * desprezível) e reprocessa qualquer linha 'pending' com send_at já
 * vencido — cobre o caso raro de o processo cair entre o INSERT e o
 * inngest.send (sem isso, essa linha específica ficaria pending pra
 * sempre).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { deliverScheduledMessage, type ScheduledRow } from '@/lib/whatsapp/scheduled-delivery'

async function claimAndDeliver(admin: ReturnType<typeof createAdminClient>, step: any, scheduledId: string, stepSuffix = '') {
  const row: ScheduledRow | null = await step.run(`fetch-row${stepSuffix}`, async () => {
    const { data } = await admin
      .from('scheduled_whatsapp_messages')
      .select('id, organization_id, conversation_id, contato_id, contact_phone, body, fallback_template_id, fallback_variables')
      .eq('id', scheduledId)
      .eq('status', 'pending')
      .maybeSingle()
    return data
  })
  if (!row) return { skipped: 'not_pending_anymore' }

  const claimed: boolean = await step.run(`claim${stepSuffix}`, async () => {
    const { data } = await admin
      .from('scheduled_whatsapp_messages')
      .update({ status: 'sending' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
    return !!(data && data.length > 0)
  })
  if (!claimed) return { skipped: 'already_claimed' }

  return step.run(`deliver${stepSuffix}`, async () => deliverScheduledMessage(admin, row))
}

export const scheduledWhatsappMessageFn = inngest.createFunction(
  {
    id:      'deliver-scheduled-whatsapp-message',
    name:    'WhatsApp: envio agendado (evento)',
    retries: 2,
    triggers: [{ event: 'whatsapp/message.scheduled' }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { scheduledId, sendAt } = event.data as { scheduledId: string; sendAt: string }
    const admin = createAdminClient()

    if (new Date(sendAt).getTime() > Date.now()) {
      await step.sleepUntil('wait-until-send', sendAt)
    }

    return claimAndDeliver(admin, step, scheduledId)
  },
)

export const scheduledMessagesReconcileFn = inngest.createFunction(
  {
    id:      'scheduled-whatsapp-messages-reconcile',
    name:    'WhatsApp: rede de segurança de envios agendados',
    retries: 1,
    // 1x/dia — só existe pra pegar a linha rara cujo evento se perdeu
    // (crash entre o INSERT e o inngest.send). Custo desprezível (~30/mês).
    triggers: [{ cron: '0 5 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const nowISO = new Date().toISOString()

    const orphans: { id: string }[] = await step.run('fetch-orphans', async () => {
      const { data } = await admin
        .from('scheduled_whatsapp_messages')
        .select('id')
        .eq('status', 'pending')
        .lte('send_at', nowISO)
        .limit(100)
      return data || []
    })

    let delivered = 0
    for (const o of orphans) {
      const res = await claimAndDeliver(admin, step, o.id, `-${o.id}`)
      if ((res as any)?.ok) delivered++
    }
    return { orphansFound: orphans.length, delivered }
  },
)
