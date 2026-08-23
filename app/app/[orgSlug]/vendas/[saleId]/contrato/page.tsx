import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'
import { getPlanContractRenderData } from '@/actions/plan-contracts'
import PlanContractPrintView from '@/components/features/agencias-trafego/PlanContractPrintView'

export const dynamic = 'force-dynamic'

/**
 * Contrato de assinatura de plano (Agências de Tráfego) — venda genérica
 * (sales) + tabela plan_contracts própria (actions/plan-contracts.ts),
 * não compartilhada com o motor de contrato de Reservas/Viagens.
 */
export default async function PlanoContractPrintPage({
  params,
}: { params: { orgSlug: string; saleId: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const data = await getPlanContractRenderData(params.orgSlug, params.saleId)
  if (!data.ok) notFound()

  return <PlanContractPrintView sale={data.sale} org={data.org} bodyHtml={data.hasTemplate ? data.bodyHtml : undefined} />
}
