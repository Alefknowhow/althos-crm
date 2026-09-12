import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listProperties } from '@/actions/properties'
import { listOrgMembers } from '@/actions/team'
import PropertyList from '@/components/features/properties/PropertyList'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function PropertiesPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'imoveis')

  const [properties, members] = await Promise.all([
    listProperties(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])

  return <PropertyList orgSlug={params.orgSlug} properties={properties} members={members} />
}
