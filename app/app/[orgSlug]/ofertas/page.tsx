import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listOffers } from '@/actions/quotations'
import { getVitrineToken } from '@/actions/travel-showcase'
import OffersList from '@/components/features/quotations/OffersList'
import { PageHeader } from '@/components/ui/page-header'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function OffersPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'ofertas')

  const [offers, vitrineToken] = await Promise.all([
    listOffers(params.orgSlug),
    getVitrineToken(params.orgSlug),
  ])

  return (
    <div className="pt-3 space-y-6">
      <PageHeader
        title="Ofertas"
        hint="Monte pacotes prontos (do mesmo jeito que uma cotação, sem cliente) e publique na vitrine. Cada oferta vira uma cotação com um clique."
      />
      <OffersList orgSlug={params.orgSlug} offers={offers} vitrineToken={vitrineToken} />
    </div>
  )
}
