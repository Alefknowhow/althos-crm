'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission, isOrgManager } from '@/lib/permissions.server'
import { TwilioVoiceProvider } from '@/lib/voice/providers/twilio'

export interface VoiceLimits {
  daily_cents?: number | null
  monthly_cents?: number | null
  per_call_cents?: number | null
  automation_max_cents?: number | null
}

export async function getVoiceAccountSettings(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.', account: null }

  const supabase = createClient()
  const { data, error } = await supabase.from('voice_accounts').select('id, status, provider, recording_policy, limits').eq('organization_id', org.id).maybeSingle()
  if (error) return { ok: false as const, error: error.message, account: null }
  return { ok: true as const, account: data }
}

export async function updateVoiceAccountSettings(orgSlug: string, patch: { recordingPolicy?: string; limits?: VoiceLimits }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }

  if (!(await isOrgManager(org.id, user.id))) return { ok: false as const, error: 'Apenas administradores podem alterar as configurações do Althos Voice.' }

  const admin = createAdminClient()
  const update: Record<string, unknown> = {}
  if (patch.recordingPolicy) update.recording_policy = patch.recordingPolicy
  if (patch.limits) update.limits = patch.limits

  const { error } = await admin
    .from('voice_accounts')
    .upsert({ organization_id: org.id, ...update }, { onConflict: 'organization_id' })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/voice/conta`)
  return { ok: true as const }
}

/**
 * Ativa o Althos Voice para uma organização: cria a subconta Twilio (conta
 * master via TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN) e grava voice_accounts +
 * voice_provider_credentials. Idempotente — se já existe subconta, não cria
 * outra.
 */
export async function activateVoiceAccount(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }

  if (!(await isOrgManager(org.id, user.id))) {
    return { ok: false as const, error: 'Apenas administradores podem ativar o Althos Voice.' }
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('voice_accounts')
    .select('id, status, provider_subaccount_sid')
    .eq('organization_id', org.id)
    .maybeSingle()

  if (existing?.status === 'active' && existing.provider_subaccount_sid) {
    return { ok: true as const }
  }

  let subaccount
  try {
    subaccount = await TwilioVoiceProvider.createSubaccount(`Althos Voice — ${org.slug || org.id}`)
  } catch (err: any) {
    return { ok: false as const, error: `Falha ao criar subconta Twilio: ${err.message || err}` }
  }

  const { data: account, error: accountError } = await admin
    .from('voice_accounts')
    .upsert(
      { organization_id: org.id, provider: 'twilio', provider_subaccount_sid: subaccount.sid, status: 'active' },
      { onConflict: 'organization_id' },
    )
    .select('id')
    .single()

  if (accountError || !account) return { ok: false as const, error: accountError?.message || 'Falha ao salvar voice_accounts.' }

  const { error: credsError } = await admin
    .from('voice_provider_credentials')
    .upsert({ voice_account_id: account.id, auth_token: subaccount.authToken }, { onConflict: 'voice_account_id' })

  if (credsError) return { ok: false as const, error: credsError.message }

  revalidatePath(`/app/${orgSlug}/voice/conta`)
  return { ok: true as const }
}
