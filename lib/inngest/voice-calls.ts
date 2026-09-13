/**
 * Althos Voice — coloca a chamada de fato no provider, de forma idempotente:
 * a Server Action (actions/voice-calls.ts::startCall) só insere a linha
 * `voice_calls` com status 'queued' e dispara este evento — a chamada em si
 * (e o débito de créditos) acontece aqui, dentro do step.run do Inngest.
 */
import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { getVoiceProvider } from '../voice/get-provider'
import { getAccountIdForOrgSlug } from '../plans/server'
import { consumeVoiceCredits, refundVoiceCredits, buildVoiceIdempotencyKey } from '../voice/credits'

export const placeVoiceCallFn = inngest.createFunction(
  {
    id: 'voice-place-call',
    name: 'Althos Voice: iniciar chamada',
    retries: 1,
    concurrency: { key: 'event.data.organizationId', limit: 5 },
    triggers: [{ event: 'voice/call.requested' }],
  },
  async ({ event, step }) => {
    const { voiceCallId, organizationId } = event.data as { voiceCallId: string; organizationId: string }
    const admin = createAdminClient()

    const result = await step.run('place-call', async () => {
      const { data: call } = await admin.from('voice_calls').select('*, organizations(slug, account_id)').eq('id', voiceCallId).maybeSingle()
      if (!call) return { skipped: 'call-not-found' }
      if (call.status !== 'queued') return { skipped: 'already-processed', status: call.status }

      const accountId = call.organizations?.account_id ?? (await getAccountIdForOrgSlug(call.organizations?.slug ?? ''))
      if (!accountId) return { skipped: 'no-account' }

      // Reserva o custo estimado de 1 minuto antes de discar — evita que uma
      // organização sem saldo consiga colocar uma chamada no ar. O custo real
      // é reconciliado quando o webhook de conclusão traz a duração final.
      const ESTIMATED_MINUTE_COST_CENTS = 15
      const debit = await consumeVoiceCredits({
        accountId,
        organizationId,
        usageType: 'call_human',
        providerCostCents: ESTIMATED_MINUTE_COST_CENTS,
        voiceCallId,
        metadata: { reason: 'call_reserve' },
        // Chave estável por chamada: um retry deste step (falha de rede antes
        // de chegar no provider) nunca debita a reserva duas vezes.
        idempotencyKey: buildVoiceIdempotencyKey('call_human', `reserve:${voiceCallId}`),
      })

      if (!debit.success) {
        await admin.from('voice_calls').update({ status: 'failed', outcome: 'saldo_insuficiente' }).eq('id', voiceCallId)
        return { skipped: 'insufficient_credits' }
      }

      const provider = await getVoiceProvider(organizationId)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      // voiceCallId + agentIdentity (user_id) vão na querystring do answerUrl:
      // quando o cliente atende, o webhook usa isso pra saber qual chamada é
      // essa e pra qual Twilio Client (agente logado no navegador) fazer o
      // <Dial>, sem precisar de uma segunda tabela de mapeamento.
      const answerUrl = `${baseUrl}/api/webhooks/voice/twilio/answer?voiceCallId=${voiceCallId}&agentIdentity=${call.user_id}`

      const { data: voiceAccount } = await admin.from('voice_accounts').select('recording_policy').eq('organization_id', organizationId).maybeSingle()
      const policy = voiceAccount?.recording_policy ?? 'off'
      const shouldRecord = policy === 'always' || (policy === 'ai_only' && call.human_or_ai === 'ai')

      try {
        const providerResult = await provider.createCall({
          fromNumber: call.from_number,
          toNumber: call.to_number,
          answerUrl,
          statusCallbackUrl: `${baseUrl}/api/webhooks/voice/twilio/status?voiceCallId=${voiceCallId}`,
          record: shouldRecord,
          recordingStatusCallbackUrl: shouldRecord ? `${baseUrl}/api/webhooks/voice/twilio/recording?voiceCallId=${voiceCallId}` : undefined,
        })

        await admin.from('voice_calls').update({
          provider_call_id: providerResult.providerCallId,
          status: 'ringing',
          started_at: new Date().toISOString(),
        }).eq('id', voiceCallId)

        return { providerCallId: providerResult.providerCallId }
      } catch (err: any) {
        // O provider falhou DEPOIS do débito da reserva — a organização não
        // recebeu a chamada, então não deve pagar por ela. Estorna antes de
        // marcar como falha (falha "depois da chamada" — seção 23 do pedido
        // de billing: nunca cobrar por um recurso que não foi entregue).
        if (debit.transactionId) {
          await refundVoiceCredits(debit.transactionId, err?.message || 'provider_error')
        }
        await admin.from('voice_calls').update({ status: 'failed', outcome: err?.message || 'provider_error' }).eq('id', voiceCallId)
        throw err
      }
    })

    return result
  },
)
