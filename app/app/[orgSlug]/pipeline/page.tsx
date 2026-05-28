import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KanbanBoard from '@/components/features/KanbanBoard'
import PipelineConfigDialog from '@/components/features/PipelineConfigDialog'
import PipelineSwitcher from '@/components/features/pipeline/PipelineSwitcher'

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams?: { pipeline_id?: string }
}) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  // List all org pipelines so the switcher knows what to offer.
  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name, is_default')
    .eq('organization_id', org.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Nenhum pipeline configurado.</p>
        <a
          href={`/app/${params.orgSlug}/configuracoes/pipelines`}
          className="text-primary underline text-sm"
        >
          Criar primeiro pipeline
        </a>
      </div>
    )
  }

  // Pick: ?pipeline_id=<id> if valid, otherwise the default, otherwise the first.
  const requested = searchParams?.pipeline_id
  const pipeline =
    (requested && pipelines.find(p => p.id === requested)) ||
    pipelines.find(p => p.is_default) ||
    pipelines[0]

  // If the URL had an invalid id, normalize the URL.
  if (requested && requested !== pipeline.id) {
    redirect(`/app/${params.orgSlug}/pipeline?pipeline_id=${pipeline.id}`)
  }

  const [{ data: stages }, { data: leads }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('id, name, position, color, pipeline_id')
      .eq('pipeline_id', pipeline.id)
      .order('position'),
    supabase
      .from('leads')
      .select('id, name, stage_id, value_cents, tags, updated_at, email, phone')
      .eq('pipeline_id', pipeline.id)
      .eq('organization_id', org.id)
      .order('updated_at', { ascending: false }),
  ])

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <PipelineSwitcher
          orgSlug={params.orgSlug}
          pipelines={pipelines}
          currentId={pipeline.id}
        />
        <PipelineConfigDialog
          orgSlug={params.orgSlug}
          pipeline={pipeline}
          stages={stages || []}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          orgSlug={params.orgSlug}
          initialStages={stages || []}
          initialLeads={leads || []}
        />
      </div>
    </div>
  )
}
