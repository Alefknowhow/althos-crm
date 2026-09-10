'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'

export async function setMyVoicePresence(orgSlug: string, status: 'online' | 'busy' | 'dnd' | 'offline') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const supabase = createClient()
  const { error } = await supabase.from('voice_agent_presence').upsert(
    { organization_id: org.id, user_id: user.id, status, updated_at: new Date().toISOString() },
    { onConflict: 'organization_id,user_id' },
  )
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/voice/equipe`)
  return { ok: true as const }
}

export async function listVoiceTeam(orgSlug: string) {
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.', team: [] }
  const org = await getCurrentOrganization(orgSlug) as any
  const supabase = createClient()

  // memberships.user_id não tem FK declarada pra profiles — um embed
  // memberships(profiles(...)) não resolve (mesmo motivo documentado em
  // lib/inngest/daily-digest-cron.ts). Busca separada e junta em JS.
  const { data: members } = await supabase.from('memberships').select('user_id').eq('organization_id', org.id)
  const userIds = (members ?? []).map(m => m.user_id)
  const { data: profileRows } = userIds.length ? await supabase.from('profiles').select('id, name, email').in('id', userIds) : { data: [] as any[] }
  const profileById = new Map((profileRows ?? []).map((p: any) => [p.id, p]))

  const { data: presence } = await supabase.from('voice_agent_presence').select('user_id, status').eq('organization_id', org.id)
  const presenceByUser = new Map((presence ?? []).map(p => [p.user_id, p.status]))

  const since = new Date(); since.setHours(0, 0, 0, 0)
  const { data: calls } = await supabase.from('voice_calls').select('user_id, status, duration_seconds').eq('organization_id', org.id).eq('human_or_ai', 'human').gte('created_at', since.toISOString())

  const team = (members ?? []).map((m: any) => {
    const userCalls = (calls ?? []).filter(c => c.user_id === m.user_id)
    const inProgress = userCalls.find(c => c.status === 'in_progress')
    const profile = profileById.get(m.user_id)
    return {
      userId: m.user_id,
      name: profile?.name || profile?.email || 'Sem nome',
      status: presenceByUser.get(m.user_id) || 'offline',
      inCall: !!inProgress,
      callsToday: userCalls.length,
    }
  })

  return { ok: true as const, team }
}
