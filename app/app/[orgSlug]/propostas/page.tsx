import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listProposals } from '@/actions/property-proposals'
import { listProperties } from '@/actions/properties'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import PropertyProposalsView from '@/components/features/properties/PropertyProposalsView'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function PropertyProposalsPage({
  params, searchParams,
}: { params: { orgSlug: string }; searchParams?: { preselect?: string; contato?: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'imoveis')

  const [proposals, properties, contatos] = await Promise.all([
    listProposals(params.orgSlug),
    listProperties(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
  ])

  const preselectedPropertyIds = searchParams?.preselect ? searchParams.preselect.split(',').filter(Boolean) : undefined

  return (
    <PropertyProposalsView
      orgSlug={params.orgSlug}
      proposals={proposals}
      properties={properties}
      contatos={contatos}
      preselectedPropertyIds={preselectedPropertyIds}
      preselectedContatoId={searchParams?.contato}
    />
  )
}
