import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listPackages, getVitrineToken } from '@/actions/travel-showcase'
import ShowcaseList from '@/components/features/showcase/ShowcaseList'

export const dynamic = 'force-dynamic'

export default async function VitrinePage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  // Niche-gated feature.
  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  const [packages, vitrineToken] = await Promise.all([
    listPackages(params.orgSlug),
    getVitrineToken(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ofertas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monte pacotes prontos de viagem e compartilhe a vitrine pública com seus clientes. Cada pacote pode virar uma proposta com um clique.
        </p>
      </div>

      <ShowcaseList orgSlug={params.orgSlug} packages={packages} vitrineToken={vitrineToken} />
    </div>
  )
}
