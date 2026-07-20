import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listProposals, listLeadsForPicker } from '@/actions/travel-proposals'
import { listOrgMembers } from '@/actions/team'
import { listBudgetDocuments } from '@/actions/budget-documents'
import CotacoesTabs from '@/components/features/quotations/CotacoesTabs'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  // Niche-gated feature.
  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  const [proposals, members, contatos, budgetDocuments] = await Promise.all([
    listProposals(params.orgSlug),
    listOrgMembers(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
    listBudgetDocuments(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotações"
        hint="Monte propostas completas, vincule a um lead do pipeline e compartilhe por link ou PDF. Na aba Orçamento IA, gere um orçamento institucional a partir de uma imagem ou PDF."
      />

      <CotacoesTabs orgSlug={params.orgSlug} proposals={proposals} members={members} contatos={contatos} budgetDocuments={budgetDocuments} />
    </div>
  )
}
