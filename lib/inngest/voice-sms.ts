/**
 * Envia um SMS disparado por automação (step "Enviar SMS" em
 * automation-step-executor.ts). Fora do request HTTP da action manual pra
 * manter o step da automação idempotente — um replay do Inngest não reenvia
 * porque o evento só é despachado uma vez pelo step.run do automation run.
 */
import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { getVoiceProvider } from '../voice/get-provider'
import { consumeVoiceCredits, refundVoiceCredits, buildVoiceIdempotencyKey } from '../voice/credits'
import { getAccountIdForOrgSlug } from '../plans/server'

const SMS_SEGMENT_COST_CENTS = 5

export const sendVoiceSmsFn = inngest.createFunction(
  { id: 'voice-send-sms', name: 'Althos Voice: enviar SMS (automação)', retries: 2, triggers: [{ event: 'voice/sms.requested' }] },
  async ({ event, step }) => {
    const { organizationId, contatoId, fromNumber, toNumber, body } = event.data as {
      organizationId: string; contatoId: string | null; fromNumber: string; toNumber: string; body: string
    }

    return step.run('send-sms', async () => {
      const admin = createAdminClient()
      const { data: org } = await admin.from('organizations').select('slug, account_id').eq('id', organizationId).maybeSingle()
      const accountId = org?.account_id ?? (org?.slug ? await getAccountIdForOrgSlug(org.slug) : null)
      if (!accountId) return { skipped: 'no-account' }

      const segments = Math.max(1, Math.ceil(body.length / 160))
      const debit = await consumeVoiceCredits({
        accountId,
        organizationId,
        usageType: 'sms',
        providerCostCents: segments * SMS_SEGMENT_COST_CENTS,
        metadata: { segments, source: 'automation' },
        // event.id é estável entre retries do MESMO evento Inngest — protege
        // contra double-charge se este step.run for reexecutado.
        idempotencyKey: buildVoiceIdempotencyKey('sms', event.id),
      })
      if (!debit.success) return { skipped: 'insufficient_credits' }

      let result: Awaited<ReturnType<Awaited<ReturnType<typeof getVoiceProvider>>['sendSMS']>>
      try {
        const provider = await getVoiceProvider(organizationId)
        result = await provider.sendSMS(fromNumber, toNumber, body)
      } catch (err: any) {
        // Falha DEPOIS do débito — o SMS não foi enviado, então estorna
        // (seção 23 do pedido de billing: nunca cobrar por algo não entregue).
        //
        // Deliberadamente NÃO relança o erro aqui: se o Inngest reexecutasse
        // este step (retries: 2), a MESMA idempotencyKey encontraria a
        // transação original (já estornada) e devolveria um "replay" —
        // reportando sucesso sem debitar de novo, ou seja, o reenvio sairia
        // de graça. Parar o retry aqui é o comportamento seguro; disparar um
        // novo evento (novo event.id) é a forma correta de tentar de novo.
        if (debit.transactionId) {
          await refundVoiceCredits(debit.transactionId, err?.message || 'provider_error')
        }
        await admin.from('sms_messages').insert({
          organization_id: organizationId, contato_id: contatoId, direction: 'outbound',
          from_number: fromNumber, to_number: toNumber, body,
          status: 'failed', segments, provider_cost_cents: 0, althos_cost_cents: 0,
        })
        return { skipped: 'provider_error', error: err?.message || 'provider_error' }
      }

      await admin.from('sms_messages').insert({
        organization_id: organizationId, contato_id: contatoId, direction: 'outbound',
        from_number: fromNumber, to_number: toNumber, body, provider_message_id: result.providerMessageId,
        status: 'sent', segments, provider_cost_cents: segments * SMS_SEGMENT_COST_CENTS, althos_cost_cents: debit.althosCostCents,
      })

      if (contatoId) {
        await admin.from('contato_activities').insert({ organization_id: organizationId, contato_id: contatoId, type: 'sms_sent', payload: { text: body } })
      }

      return { providerMessageId: result.providerMessageId }
    })
  },
)
