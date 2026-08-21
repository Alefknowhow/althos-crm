import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isRealEstateNiche } from '@/lib/niche'
import { getProperty } from '@/actions/properties'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import { listOrgMembers } from '@/actions/team'
import { listInterestsByProperty } from '@/actions/property-interests'
import { listVisitsByProperty } from '@/actions/property-visits'
import PropertyEditor from '@/components/features/properties/PropertyEditor'

export const dynamic = 'force-dynamic'

export default async function PropertyEditorPage({
  params,
}: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isRealEstateNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [full, contatos, members, interests, visits] = await Promise.all([
    getProperty(params.orgSlug, params.id),
    listLeadsForPicker(params.orgSlug),
    listOrgMembers(params.orgSlug),
    listInterestsByProperty(params.orgSlug, params.id),
    listVisitsByProperty(params.orgSlug, params.id),
  ])
  if (!full) notFound()

  return (
    <PropertyEditor
      orgSlug={params.orgSlug}
      property={full.property}
      media={full.media}
      contatos={contatos}
      members={members}
      interests={interests}
      visits={visits}
    />
  )
}
