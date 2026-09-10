'use server'

/** Emite um Access Token efêmero do Twilio Voice SDK pro navegador (WebRTC).
 *  Nunca expõe Account SID/Auth Token — só um JWT de curta duração. */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getVoiceProvider } from '@/lib/voice/get-provider'

export async function getBrowserCallToken(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }

  try {
    const provider = await getVoiceProvider(org.id)
    const { token, ttlSeconds } = await provider.createBrowserAccessToken(user.id)
    return { ok: true as const, token, ttlSeconds }
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Erro ao emitir token de chamada.' }
  }
}
