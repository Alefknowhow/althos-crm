import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listProposals, listLeadsForPicker } from '@/actions/travel-proposals'
import { listOrgMembers } from '@/actions/team'
import ProposalsList from '@/components/features/proposals/ProposalsList'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  // Niche-gated feature.
  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  const [proposals, members, contatos] = await Promise.all([
    listProposals(params.orgSlug),
    listOrgMembers(params.orgSlug),
    listLeadsForPicker(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotações"
        hint="Monte propostas completas, vincule a um lead do pipeline e compartilhe por link ou PDF."
      />

      <ProposalsList orgSlug={params.orgSlug} proposals={proposals} members={members} contatos={contatos} />
    </div>
  )
}
