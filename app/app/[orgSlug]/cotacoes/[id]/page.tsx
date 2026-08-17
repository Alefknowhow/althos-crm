import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getQuotationFull } from '@/actions/quotations'
import { listLeadsForPicker } from '@/actions/travel-proposals'
import QuotationEditor from '@/components/features/quotations/QuotationEditor'

export const dynamic = 'force-dynamic'
// PDFs de várias páginas no "Orçamento IA" (extractTravelDocument) podem
// levar mais que os ~15s padrão da função serverless até a Claude terminar
// a leitura por visão — sem isso, o upload trava/falha silenciosamente
// bem antes do timeout de payload já corrigido em next.config.mjs.
export const maxDuration = 60

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

  const leads = await listLeadsForPicker(params.orgSlug)

  return <QuotationEditor orgSlug={params.orgSlug} initial={full} leads={leads} />
}
