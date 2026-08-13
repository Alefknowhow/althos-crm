import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAccountOrganizations } from '@/actions/organization'
import { getTeamData } from '@/actions/team'
import OrganizationsClient from './OrganizationsClient'

export default async function OrganizacoesPage({ params }: { params: { orgSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  const [organizations, team] = await Promise.all([
    getAccountOrganizations(params.orgSlug),
    getTeamData(params.orgSlug),
  ])

  return (
    <OrganizationsClient
      orgSlug={params.orgSlug}
      organizations={organizations}
      members={team.members}
      canManage={team.currentUserIsManager}
    />
  )
}
