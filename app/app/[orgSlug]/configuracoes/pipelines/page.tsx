import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listPipelines } from '@/actions/pipeline'
import PipelinesManager from '@/components/features/pipeline/PipelinesManager'

export default async function PipelinesConfigPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const pipelines = await listPipelines(params.orgSlug)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
        <p className="text-muted-foreground text-sm">
          Organize seus leads em fluxos distintos. Cada cliente, vertical ou produto pode ter seu próprio pipeline.
        </p>
      </div>

      <PipelinesManager orgSlug={params.orgSlug} initial={pipelines} />
    </div>
  )
}
