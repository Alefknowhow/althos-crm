import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isRealEstateNiche } from '@/lib/niche'
import { listProposals } from '@/actions/property-proposals'
import { listProperties } from '@/actions/properties'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import PropertyProposalsView from '@/components/features/properties/PropertyProposalsView'

export const dynamic = 'force-dynamic'

export default async function PropertyProposalsPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isRealEstateNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [proposals, properties, contatos] = await Promise.all([
    listProposals(params.orgSlug),
    listProperties(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
  ])

  return (
    <PropertyProposalsView
      orgSlug={params.orgSlug}
      proposals={proposals}
      properties={properties}
      contatos={contatos}
    />
  )
}
