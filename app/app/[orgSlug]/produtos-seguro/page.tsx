import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isInsuranceNiche } from '@/lib/niche'
import { listInsuranceProducts } from '@/actions/insurance-products'
import InsuranceProductsView from '@/components/features/insurance/InsuranceProductsView'

export const dynamic = 'force-dynamic'

export default async function InsuranceProductsPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isInsuranceNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const products = await listInsuranceProducts(params.orgSlug)

  return <InsuranceProductsView orgSlug={params.orgSlug} products={products} />
}
