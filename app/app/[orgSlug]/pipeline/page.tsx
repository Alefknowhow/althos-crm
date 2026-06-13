import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getProfilesMap } from '@/lib/profiles'
import { redirect } from 'next/navigation'
import KanbanBoard from '@/components/features/KanbanBoard'
import PipelineConfigDialog from '@/components/features/PipelineConfigDialog'
import PipelineSwitcher from '@/components/features/pipeline/PipelineSwitcher'
import PipelineKpiBar from '@/components/features/pipeline/PipelineKpiBar'

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
      .select('id, name, position, color, pipeline_id, is_won, is_lost')
      .eq('pipeline_id', pipeline.id)
      .order('position'),
    supabase
      .from('contatos')
      .select(
        'id, name, stage_id, value_cents, tags, updated_at, created_at, last_activity_at, email, phone, assigned_to, ai_score, ai_tier, status, source',
      )
      .eq('pipeline_id', pipeline.id)
      .eq('organization_id', org.id)
      .order('updated_at', { ascending: false }),
  ])

  // Resolve members (id → name/email) for owner avatars + the responsável filter.
  // Best-effort: never let it break the board.
  let members: { id: string; name: string; email: string }[] = []
  try {
    const admin = createAdminClient()
    const { data: memberships } = await admin
      .from('memberships')
      .select('user_id')
      .eq('organization_id', org.id)
    const ids = Array.from(new Set((memberships ?? []).map(m => m.user_id)))
    const profiles = await getProfilesMap(ids)
    members = ids.map(id => {
      const p = profiles.get(id)
      return { id, name: p?.full_name || '', email: p?.email || '' }
    })
  } catch {
    members = []
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex justify-between items-center mb-4 shrink-0">
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

      {/* Dashboard (KPIs) — desktop/web only */}
      <div className="hidden md:block mb-4 shrink-0">
        <PipelineKpiBar leads={leads || []} />
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          orgSlug={params.orgSlug}
          initialStages={stages || []}
          initialLeads={leads || []}
          members={members}
        />
      </div>
    </div>
  )
}
