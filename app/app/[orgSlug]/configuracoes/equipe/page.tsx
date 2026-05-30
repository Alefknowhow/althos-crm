import { getTeamData } from '@/actions/team'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'

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
    <TeamClient
      orgSlug={params.orgSlug}
      currentUserId={user.id}
      currentUserRole={membership.role as 'owner' | 'admin'}
      {...teamData}
    />
  )
}
