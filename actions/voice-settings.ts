'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission, isOrgManager } from '@/lib/permissions.server'

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
  revalidatePath(`/app/${orgSlug}/voice/configuracoes`)
  return { ok: true as const }
}
