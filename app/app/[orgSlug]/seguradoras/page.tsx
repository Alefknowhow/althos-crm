import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isInsuranceNiche } from '@/lib/niche'
import { listInsurers } from '@/actions/insurers'
import InsurersView from '@/components/features/insurance/InsurersView'

export const dynamic = 'force-dynamic'

export default async function InsurersPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isInsuranceNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const insurers = await listInsurers(params.orgSlug)

  return <InsurersView orgSlug={params.orgSlug} insurers={insurers} />
}
