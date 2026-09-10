/**
 * Retry de chamadas de Voice AI disparadas por automação que não foram
 * atendidas — intervalo fixo de 2h, nunca repete depois das 18h (horário de
 * Brasília) e nunca ultrapassa voice_calls.max_attempts (teto configurado no
 * step da automação — ver lib/inngest/automation-step-executor.ts). Sem
 * isso, uma automação continuaria discando indefinidamente pra um número
 * que nunca atende.
 */
import { inngest } from './client'
import { createAdminClient } from '../supabase/server'

const RETRY_INTERVAL_HOURS = 2
const NO_RETRY_AFTER_HOUR_BRT = 18

export const voiceCallRetryFn = inngest.createFunction(
  { id: 'voice-call-retry', name: 'Althos Voice: retry de chamada não atendida', retries: 1, triggers: [{ event: 'voice/call.retry.requested' }] },
  async ({ event, step }) => {
    const { voiceCallId, organizationId } = event.data as { voiceCallId: string; organizationId: string }

    await step.sleep('wait-retry-interval', `${RETRY_INTERVAL_HOURS}h`)

    return step.run('place-retry', async () => {
      const admin = createAdminClient()
      const { data: original } = await admin.from('voice_calls').select('*').eq('id', voiceCallId).maybeSingle()
      if (!original) return { skipped: 'original-not-found' }
      if (original.attempt_number >= original.max_attempts) return { skipped: 'max-attempts-reached' }

      const hourBRT = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }))
      if (hourBRT >= NO_RETRY_AFTER_HOUR_BRT) return { skipped: 'after-cutoff-hour' }

      const { data: retryCall } = await admin.from('voice_calls').insert({
        organization_id: organizationId,
        contato_id: original.contato_id,
        direction: 'outbound',
        human_or_ai: original.human_or_ai,
        ai_agent_id: original.ai_agent_id,
        from_number: original.from_number,
        to_number: original.to_number,
        status: 'queued',
        attempt_number: original.attempt_number + 1,
        max_attempts: original.max_attempts,
        automation_context: original.automation_context,
      }).select('id').single()

      if (retryCall) {
        await inngest.send({ name: 'voice/call.requested', data: { voiceCallId: retryCall.id, organizationId } })
      }
      return { retryCallId: retryCall?.id }
    })
  },
)
