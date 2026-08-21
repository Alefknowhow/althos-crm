import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isInsuranceNiche } from '@/lib/niche'
import { listPolicies } from '@/actions/insurance-policies'
import { listQuotes } from '@/actions/insurance-quotes'
import { listInsuranceProducts } from '@/actions/insurance-products'
import { listInsurers } from '@/actions/insurers'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import InsurancePoliciesView from '@/components/features/insurance/InsurancePoliciesView'

export const dynamic = 'force-dynamic'

export default async function InsurancePoliciesPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isInsuranceNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [policies, quotes, products, insurers, contatos] = await Promise.all([
    listPolicies(params.orgSlug),
    listQuotes(params.orgSlug),
    listInsuranceProducts(params.orgSlug),
    listInsurers(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
  ])

  return (
    <InsurancePoliciesView
      orgSlug={params.orgSlug}
      policies={policies}
      quotes={quotes}
      products={products}
      insurers={insurers}
      contatos={contatos}
    />
  )
}
