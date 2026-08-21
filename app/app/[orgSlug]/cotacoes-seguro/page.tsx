import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isInsuranceNiche } from '@/lib/niche'
import { listQuotes } from '@/actions/insurance-quotes'
import { listInsuranceProducts } from '@/actions/insurance-products'
import { listInsurers } from '@/actions/insurers'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import InsuranceQuotesView from '@/components/features/insurance/InsuranceQuotesView'

export const dynamic = 'force-dynamic'

export default async function InsuranceQuotesPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isInsuranceNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [quotes, products, insurers, contatos] = await Promise.all([
    listQuotes(params.orgSlug),
    listInsuranceProducts(params.orgSlug),
    listInsurers(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
  ])

  return (
    <InsuranceQuotesView
      orgSlug={params.orgSlug}
      quotes={quotes}
      products={products}
      insurers={insurers}
      contatos={contatos}
    />
  )
}
