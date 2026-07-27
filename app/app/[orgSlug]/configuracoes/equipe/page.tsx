import { getTeamData } from '@/actions/team'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'
import SettingsTabsNav from '../SettingsTabsNav'

export default async function EquipePage({
  params,
}: {
  params: { orgSlug: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only owners and admins can manage the team
  const org = await getCurrentOrganization(params.orgSlug)
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    redirect(`/app/${params.orgSlug}/pipeline`)
  }

  const teamData = await getTeamData(params.orgSlug)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <TeamClient
        orgSlug={params.orgSlug}
        currentUserId={user.id}
        currentUserRole={membership.role as 'owner' | 'admin'}
        niche={org.niche}
        {...teamData}
      />
    </div>
  )
}
