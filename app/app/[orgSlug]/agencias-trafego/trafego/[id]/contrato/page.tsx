import { notFound } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getPlanContractRenderData } from '@/actions/plan-contracts'
import PlanContractPrintView from '@/components/features/agencias-trafego/PlanContractPrintView'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

/**
 * Contrato de assinatura de plano (Agências de Tráfego) — relação
 * Agência↔Cliente (contato_id), independente de vendas. Movida de
 * /vendas/[saleId]/contrato pra aqui quando o contrato deixou de ser
 * vinculado a uma venda específica.
 */
export default async function PlanoContractPrintPage({
  params,
}: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'trafego')

  const data = await getPlanContractRenderData(params.orgSlug, params.id)
  if (!data.ok) notFound()

  return <PlanContractPrintView sale={data.sale} org={data.org} bodyHtml={data.hasTemplate ? data.bodyHtml : undefined} />
}
