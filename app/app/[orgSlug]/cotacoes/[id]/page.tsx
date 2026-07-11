import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getQuotationFull } from '@/actions/quotations'
import QuotationEditor from '@/components/features/quotations/QuotationEditor'

export const dynamic = 'force-dynamic'

export default async function QuotationEditorPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const full = await getQuotationFull(params.orgSlug, params.id)
  if (!full) notFound()

  return <QuotationEditor orgSlug={params.orgSlug} initial={full} />
}
