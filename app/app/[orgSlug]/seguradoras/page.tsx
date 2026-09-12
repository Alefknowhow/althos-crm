import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listInsurers } from '@/actions/insurers'
import InsurersView from '@/components/features/insurance/InsurersView'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function InsurersPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'seguros')

  const insurers = await listInsurers(params.orgSlug)

  return <InsurersView orgSlug={params.orgSlug} insurers={insurers} />
}
