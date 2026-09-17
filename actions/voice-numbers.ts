'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission, isOrgManager } from '@/lib/permissions.server'
import { getVoiceProvider } from '@/lib/voice/get-provider'

async function guardVoiceAdmin(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  // Compra/liberação de número é sensível — só owner/admin.
  if (!(await isOrgManager(org.id, user.id))) return { ok: false as const, error: 'Apenas administradores podem gerenciar números.' }
  return { ok: true as const, user, org }
}

export async function listOrgNumbers(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.', numbers: [] }
  const supabase = createClient()
  const { data, error } = await supabase.from('voice_numbers').select('id, e164_number, capabilities, status, assigned_user_id').eq('organization_id', org.id).eq('status', 'active').order('created_at')
  if (error) return { ok: false as const, error: error.message, numbers: [] }
  return { ok: true as const, numbers: data ?? [] }
}

export async function listAvailableNumbers(orgSlug: string, areaCodeOrCountry: string) {
  const guard = await guardVoiceAdmin(orgSlug)
  if (!guard.ok) return { ok: false as const, error: guard.error, numbers: [] }
  try {
    const provider = await getVoiceProvider(guard.org.id)
    const numbers = await provider.listAvailableNumbers(areaCodeOrCountry)
    return { ok: true as const, numbers }
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Falha ao buscar números disponíveis na Twilio.', numbers: [] }
  }
}

export async function purchaseNumber(orgSlug: string, e164Number: string) {
  const guard = await guardVoiceAdmin(orgSlug)
  if (!guard.ok) return guard
  const { org } = guard

  let purchased
  try {
    const provider = await getVoiceProvider(org.id)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    purchased = await provider.purchaseNumber(
      e164Number,
      `${baseUrl}/api/webhooks/voice/twilio/answer`,
      `${baseUrl}/api/webhooks/voice/twilio/sms`,
    )
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Falha ao comprar número na Twilio.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('voice_numbers').insert({
    organization_id: org.id,
    provider_number_sid: purchased.providerNumberSid,
    e164_number: purchased.e164Number,
    capabilities: { voice: true, sms: true },
    status: 'active',
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/voice/numeros`)
  return { ok: true as const }
}

/**
 * Importa um número que já existe na conta master da Twilio (ex.: número
 * trial) para a organização, sem passar pelo fluxo de compra — necessário
 * enquanto a conta Twilio não tem billing habilitado.
 */
export async function attachExistingNumber(orgSlug: string, e164Number: string) {
  const guard = await guardVoiceAdmin(orgSlug)
  if (!guard.ok) return guard
  const { org } = guard

  let attached
  try {
    const provider = await getVoiceProvider(org.id)
    if (!provider.attachExistingNumber) return { ok: false as const, error: 'Provider atual não suporta importar número existente.' }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    attached = await provider.attachExistingNumber(
      e164Number,
      `${baseUrl}/api/webhooks/voice/twilio/answer`,
      `${baseUrl}/api/webhooks/voice/twilio/sms`,
    )
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Falha ao importar número da Twilio.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('voice_numbers').insert({
    organization_id: org.id,
    provider_number_sid: attached.providerNumberSid,
    e164_number: attached.e164Number,
    capabilities: { voice: true, sms: true },
    status: 'active',
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/voice/numeros`)
  return { ok: true as const }
}

export async function releaseNumber(orgSlug: string, numberId: string) {
  const guard = await guardVoiceAdmin(orgSlug)
  if (!guard.ok) return guard
  const { org } = guard

  const admin = createAdminClient()
  const { data: number } = await admin.from('voice_numbers').select('provider_number_sid').eq('id', numberId).eq('organization_id', org.id).maybeSingle()
  if (!number?.provider_number_sid) return { ok: false as const, error: 'Número não encontrado.' }

  try {
    const provider = await getVoiceProvider(org.id)
    await provider.releaseNumber(number.provider_number_sid)
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Falha ao liberar número na Twilio.' }
  }

  await admin.from('voice_numbers').update({ status: 'released' }).eq('id', numberId)
  revalidatePath(`/app/${orgSlug}/voice/numeros`)
  return { ok: true as const }
}
