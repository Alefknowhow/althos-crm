import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'
import { getContractRenderData } from '@/actions/contracts'
import PlanContractPrintView from '@/components/features/agencias-trafego/PlanContractPrintView'

export const dynamic = 'force-dynamic'

/**
 * Contrato de assinatura de plano (Agências de Tráfego) — venda genérica
 * (sales), mesmo mecanismo de renderização de reservas/[saleId]/contrato,
 * só que sem acoplamento a travel_sales (ver actions/contracts.ts, kind
 * 'generic').
 */
export default async function PlanoContractPrintPage({
  params,
}: { params: { orgSlug: string; saleId: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const data = await getContractRenderData(params.orgSlug, params.saleId, 'generic')
  if (!data.ok) notFound()

  return <PlanContractPrintView sale={data.sale as any} org={data.org} bodyHtml={data.hasTemplate ? data.bodyHtml : undefined} />
}
