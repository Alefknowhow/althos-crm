import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getPackage, getVitrineToken } from '@/actions/travel-showcase'
import ShowcaseBuilder from '@/components/features/showcase/ShowcaseBuilder'

export const dynamic = 'force-dynamic'

export default async function ShowcaseEditorPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [pkg, vitrineToken] = await Promise.all([
    getPackage(params.orgSlug, params.id),
    getVitrineToken(params.orgSlug),
  ])
  if (!pkg) notFound()

  return <ShowcaseBuilder orgSlug={params.orgSlug} initial={pkg} vitrineToken={vitrineToken} />
}
