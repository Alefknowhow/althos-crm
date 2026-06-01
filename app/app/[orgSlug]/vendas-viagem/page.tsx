import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listTravelSales } from '@/actions/travel-sales'
import TravelSalesView from '@/components/features/proposals/TravelSalesView'

export const dynamic = 'force-dynamic'

export default async function TravelSalesPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const sales = await listTravelSales(params.orgSlug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vendas de Viagem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vendas geradas automaticamente quando um lead com proposta é fechado. Complete os localizadores e a comissão, depois gere as tarefas operacionais.
        </p>
      </div>

      <TravelSalesView orgSlug={params.orgSlug} sales={sales} />
    </div>
  )
}
