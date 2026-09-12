import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listClaims } from '@/actions/insurance-claims'
import { listPolicies } from '@/actions/insurance-policies'
import InsuranceClaimsView from '@/components/features/insurance/InsuranceClaimsView'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function InsuranceClaimsPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'seguros')

  const [claims, policies] = await Promise.all([
    listClaims(params.orgSlug),
    listPolicies(params.orgSlug),
  ])

  return <InsuranceClaimsView orgSlug={params.orgSlug} claims={claims} policies={policies} />
}
