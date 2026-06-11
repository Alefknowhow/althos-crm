import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getProposal, listLeadsForPicker } from '@/actions/travel-proposals'
import ProposalBuilder from '@/components/features/proposals/ProposalBuilder'

export const dynamic = 'force-dynamic'

export default async function ProposalEditorPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const proposal = await getProposal(params.orgSlug, params.id)
  if (!proposal) notFound()

  const leads = await listLeadsForPicker(params.orgSlug)

  return <ProposalBuilder orgSlug={params.orgSlug} initial={proposal} leads={leads} />
}
