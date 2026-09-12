import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listQuotes } from '@/actions/insurance-quotes'
import { listInsuranceProducts } from '@/actions/insurance-products'
import { listInsurers } from '@/actions/insurers'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import InsuranceQuotesView from '@/components/features/insurance/InsuranceQuotesView'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function InsuranceQuotesPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'seguros')

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
