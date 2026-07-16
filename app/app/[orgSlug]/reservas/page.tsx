import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listTravelSales } from '@/actions/travel-sales'
import { listProposals, listLeadsForPicker } from '@/actions/travel-proposals'
import { listOrgMembers } from '@/actions/team'
import TravelSalesView from '@/components/features/proposals/TravelSalesView'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function TravelSalesPage({
  params, searchParams,
}: { params: { orgSlug: string }; searchParams: { sale?: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [sales, proposals, members, leads] = await Promise.all([
    listTravelSales(params.orgSlug),
    listProposals(params.orgSlug),
    listOrgMembers(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
  ])
  const proposalOptions = proposals.map(p => ({
    id: p.id,
    title: p.title,
    client_name: p.client_name,
    contato_id: (p as any).contato_id ?? null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        hint={'Crie uma venda com "Nova venda" (importando uma proposta) ou deixe que ela seja gerada automaticamente quando um lead com proposta é movido para "Fechado". Complete os localizadores e a comissão, depois gere as tarefas operacionais.'}
      />

      <TravelSalesView orgSlug={params.orgSlug} sales={sales} proposals={proposalOptions} members={members} leads={leads} initialSelectedId={searchParams.sale ?? null} />
    </div>
  )
}
