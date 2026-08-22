import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isInsuranceNiche } from '@/lib/niche'
import { listClaims } from '@/actions/insurance-claims'
import { listPolicies } from '@/actions/insurance-policies'
import InsuranceClaimsView from '@/components/features/insurance/InsuranceClaimsView'

export const dynamic = 'force-dynamic'

export default async function InsuranceClaimsPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isInsuranceNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [claims, policies] = await Promise.all([
    listClaims(params.orgSlug),
    listPolicies(params.orgSlug),
  ])

  return <InsuranceClaimsView orgSlug={params.orgSlug} claims={claims} policies={policies} />
}
