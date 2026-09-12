import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listTravelBlocks } from '@/actions/travel-blocks'
import BlocksView from '@/components/features/blocks/BlocksView'
import { PageHeader } from '@/components/ui/page-header'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function BloqueiosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'bloqueios')

  const blocks = await listTravelBlocks(params.orgSlug)

  return (
    <div className="pt-3 space-y-6">
      <PageHeader
        title="Bloqueios"
        hint="Mapa dos lotes de assentos garantidos com a operadora: trecho, datas, voos, assentos disponíveis e prazo de release. Use os botões +/- pra baixar ou devolver assentos conforme vende."
      />

      <BlocksView orgSlug={params.orgSlug} blocks={blocks} />
    </div>
  )
}
