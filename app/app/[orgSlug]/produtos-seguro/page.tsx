import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listInsuranceProducts } from '@/actions/insurance-products'
import InsuranceProductsView from '@/components/features/insurance/InsuranceProductsView'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function InsuranceProductsPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'seguros')

  const products = await listInsuranceProducts(params.orgSlug)

  return <InsuranceProductsView orgSlug={params.orgSlug} products={products} />
}
