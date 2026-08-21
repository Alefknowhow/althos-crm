import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isRealEstateNiche } from '@/lib/niche'
import { listVisits } from '@/actions/property-visits'
import { listProperties } from '@/actions/properties'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import { listOrgMembers } from '@/actions/team'
import VisitsView from '@/components/features/properties/VisitsView'

export const dynamic = 'force-dynamic'

export default async function VisitsPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isRealEstateNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [visits, properties, contatos, members] = await Promise.all([
    listVisits(params.orgSlug),
    listProperties(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])

  return (
    <VisitsView
      orgSlug={params.orgSlug}
      visits={visits}
      properties={properties}
      contatos={contatos}
      members={members.map(m => ({ id: m.user_id, name: m.name }))}
    />
  )
}
