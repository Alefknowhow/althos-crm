'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug, getAccountIdForOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getVoiceProvider } from '@/lib/voice/get-provider'
import { consumeVoiceCredits } from '@/lib/voice/credits'

const SMS_SEGMENT_COST_CENTS = 5

export async function sendSMS(orgSlug: string, opts: { contatoId?: string; toNumber: string; fromNumberId: string; body: string }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }

  const supabase = createClient()
  const { data: fromNumber } = await supabase.from('voice_numbers').select('e164_number').eq('id', opts.fromNumberId).eq('organization_id', org.id).maybeSingle()
  if (!fromNumber) return { ok: false as const, error: 'Número de saída inválido.' }

  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada.' }

  const segments = Math.max(1, Math.ceil(opts.body.length / 160))
  const debit = await consumeVoiceCredits({
    accountId, organizationId: org.id, usageType: 'sms',
    providerCostCents: segments * SMS_SEGMENT_COST_CENTS,
    metadata: { segments },
  })
  if (!debit.success) return { ok: false as const, error: 'Saldo insuficiente no Althos Voice.' }

  const provider = await getVoiceProvider(org.id)
  const admin = createAdminClient()
  try {
    const result = await provider.sendSMS(fromNumber.e164_number, opts.toNumber, opts.body)
    await admin.from('sms_messages').insert({
      organization_id: org.id, contato_id: opts.contatoId ?? null, direction: 'outbound',
      from_number: fromNumber.e164_number, to_number: opts.toNumber, body: opts.body,
      provider_message_id: result.providerMessageId, status: 'sent', segments,
      provider_cost_cents: segments * SMS_SEGMENT_COST_CENTS, althos_cost_cents: debit.althosCostCents,
      created_by: user.id,
    })
    if (opts.contatoId) {
      await admin.from('contato_activities').insert({
        organization_id: org.id, contato_id: opts.contatoId, type: 'sms_sent',
        payload: { text: opts.body }, created_by: user.id,
      })
    }
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Erro ao enviar SMS.' }
  }

  revalidatePath(`/app/${orgSlug}/voice/sms`)
  return { ok: true as const }
}

export async function listSMS(orgSlug: string, contatoId?: string) {
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.', messages: [] }
  const org = await getCurrentOrganization(orgSlug) as any

  const supabase = createClient()
  let query = supabase.from('sms_messages').select('id, contato_id, direction, from_number, to_number, body, status, segments, althos_cost_cents, created_at, contatos(name)').eq('organization_id', org.id).order('created_at', { ascending: false }).limit(100)
  if (contatoId) query = query.eq('contato_id', contatoId)

  const { data, error } = await query
  if (error) return { ok: false as const, error: error.message, messages: [] }
  return { ok: true as const, messages: data ?? [] }
}
