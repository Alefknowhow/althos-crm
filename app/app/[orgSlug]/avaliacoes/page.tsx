import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getLinkedGoogleBusinessLocations, listGoogleBusinessReviewsForLocation } from '@/actions/google-business'
import ReviewsClient from './ReviewsClient'

export const dynamic = 'force-dynamic'

export default async function AvaliacoesPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { location?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const locations = await getLinkedGoogleBusinessLocations(params.orgSlug)
  const activeLocationId = searchParams.location && locations.find(l => l.id === searchParams.location)
    ? searchParams.location
    : locations[0]?.id

  const reviews = activeLocationId
    ? await listGoogleBusinessReviewsForLocation(params.orgSlug, activeLocationId)
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Avaliações do Google</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Veja e responda as avaliações do Perfil da Empresa no Google, direto do CRM.
        </p>
      </div>

      <ReviewsClient
        orgSlug={params.orgSlug}
        locations={locations}
        activeLocationId={activeLocationId ?? null}
        initialReviews={reviews}
      />
    </div>
  )
}
