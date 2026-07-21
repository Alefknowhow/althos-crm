import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listTravelBlocks } from '@/actions/travel-blocks'
import BlocksView from '@/components/features/blocks/BlocksView'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function BloqueiosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const blocks = await listTravelBlocks(params.orgSlug)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bloqueios"
        hint="Mapa dos lotes de assentos garantidos com a operadora: trecho, datas, voos, assentos disponíveis e prazo de release. Use os botões +/- pra baixar ou devolver assentos conforme vende."
      />

      <BlocksView orgSlug={params.orgSlug} blocks={blocks} />
    </div>
  )
}
