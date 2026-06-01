import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listProposals } from '@/actions/travel-proposals'
import ProposalsList from '@/components/features/proposals/ProposalsList'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  // Niche-gated feature.
  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  const proposals = await listProposals(params.orgSlug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Propostas de Viagem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monte propostas completas, vincule a um lead do pipeline e compartilhe por link ou PDF.
        </p>
      </div>

      <ProposalsList orgSlug={params.orgSlug} proposals={proposals} />
    </div>
  )
}
