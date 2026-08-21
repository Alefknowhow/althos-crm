import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isRealEstateNiche } from '@/lib/niche'
import { listDeals } from '@/actions/property-deals'
import { listProposals } from '@/actions/property-proposals'
import { listProperties } from '@/actions/properties'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import { listOrgMembers } from '@/actions/team'
import PropertyDealsView from '@/components/features/properties/PropertyDealsView'

export const dynamic = 'force-dynamic'

export default async function PropertyDealsPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isRealEstateNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [deals, proposals, properties, contatos, members] = await Promise.all([
    listDeals(params.orgSlug),
    listProposals(params.orgSlug),
    listProperties(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])

  return (
    <PropertyDealsView
      orgSlug={params.orgSlug}
      deals={deals}
      properties={properties}
      contatos={contatos}
      members={members}
      proposals={proposals}
    />
  )
}
