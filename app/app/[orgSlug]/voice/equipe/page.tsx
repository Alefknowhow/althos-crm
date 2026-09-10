import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { listVoiceTeam } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { VoiceTeamClient } from '@/components/features/voice/VoiceTeamClient'

export const dynamic = 'force-dynamic'

export default async function VoiceEquipePage({ params }: { params: { orgSlug: string } }) {
  const user = await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const result = await listVoiceTeam(params.orgSlug)
  const team = result.ok ? result.team : []

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Equipe" hint="Status e atividade da equipe no Althos Voice." />
      <VoiceTeamClient orgSlug={params.orgSlug} currentUserId={user.id} team={team} />
    </div>
  )
}
