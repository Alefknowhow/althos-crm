import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listTravelSales } from '@/actions/travel-sales'
import { listProposals } from '@/actions/travel-proposals'
import { listOrgMembers } from '@/actions/team'
import TravelSalesView from '@/components/features/proposals/TravelSalesView'

export const dynamic = 'force-dynamic'

export default async function TravelSalesPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [sales, proposals, members] = await Promise.all([
    listTravelSales(params.orgSlug),
    listProposals(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])
  const proposalOptions = proposals.map(p => ({
    id: p.id,
    title: p.title,
    client_name: p.client_name,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie uma venda com "Nova venda" (importando uma proposta) ou deixe que ela seja gerada automaticamente quando um lead com proposta é movido para "Fechado". Complete os localizadores e a comissão, depois gere as tarefas operacionais.
        </p>
      </div>

      <TravelSalesView orgSlug={params.orgSlug} sales={sales} proposals={proposalOptions} members={members} />
    </div>
  )
}
