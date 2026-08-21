import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isRealEstateNiche } from '@/lib/niche'
import { ensureRealEstatePipeline } from '@/actions/pipeline-imoveis'

export const dynamic = 'force-dynamic'

/**
 * Rota fina de redirect — não é um board próprio. Garante (get-or-create)
 * o pipeline `kind='imoveis'` da org e manda pro Kanban genérico já
 * apontando pra ele, reaproveitando 100% de KanbanBoard/pipeline/page.tsx.
 */
export default async function PipelineImoveisPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isRealEstateNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const { id } = await ensureRealEstatePipeline(params.orgSlug)
  redirect(`/app/${params.orgSlug}/pipeline?pipeline_id=${id}`)
}
