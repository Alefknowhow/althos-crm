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
  const provider = await getVoiceProvider(guard.org.id)
  const numbers = await provider.listAvailableNumbers(areaCodeOrCountry)
  return { ok: true as const, numbers }
}

export async function purchaseNumber(orgSlug: string, e164Number: string) {
  const guard = await guardVoiceAdmin(orgSlug)
  if (!guard.ok) return guard
  const { org } = guard

  const provider = await getVoiceProvider(org.id)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const purchased = await provider.purchaseNumber(
    e164Number,
    `${baseUrl}/api/webhooks/voice/twilio/answer`,
    `${baseUrl}/api/webhooks/voice/twilio/sms`,
  )

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

export async function releaseNumber(orgSlug: string, numberId: string) {
  const guard = await guardVoiceAdmin(orgSlug)
  if (!guard.ok) return guard
  const { org } = guard

  const admin = createAdminClient()
  const { data: number } = await admin.from('voice_numbers').select('provider_number_sid').eq('id', numberId).eq('organization_id', org.id).maybeSingle()
  if (!number?.provider_number_sid) return { ok: false as const, error: 'Número não encontrado.' }

  const provider = await getVoiceProvider(org.id)
  await provider.releaseNumber(number.provider_number_sid)

  await admin.from('voice_numbers').update({ status: 'released' }).eq('id', numberId)
  revalidatePath(`/app/${orgSlug}/voice/numeros`)
  return { ok: true as const }
}
