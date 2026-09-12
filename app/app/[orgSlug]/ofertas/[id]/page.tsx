import { notFound } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getQuotationFull } from '@/actions/quotations'
import QuotationEditor from '@/components/features/quotations/QuotationEditor'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'
// Ver cotacoes/[id]/page.tsx — mesmo editor, mesmo motivo.
export const maxDuration = 60

export default async function OfferEditorPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'ofertas')

  const full = await getQuotationFull(params.orgSlug, params.id)
  if (!full || !full.quotation?.is_offer) notFound()

  return <QuotationEditor orgSlug={params.orgSlug} initial={full} isOffer />
}
