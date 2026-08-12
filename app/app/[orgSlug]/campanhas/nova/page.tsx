import { requireAuth } from '@/lib/supabase/types'
import { getPipelinesAndStages } from '@/actions/pipeline'
import { listDistinctTags, listApprovedWaTemplates } from '@/actions/send-campaigns'
import { listEmailTemplates } from '@/actions/emails'
import NewCampaignForm from '@/components/features/campaigns/NewCampaignForm'

export default async function NovaCampanhaPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()

  const [{ pipelines, stages }, tags, waTemplates, emailTemplates] = await Promise.all([
    getPipelinesAndStages(params.orgSlug),
    listDistinctTags(params.orgSlug),
    listApprovedWaTemplates(params.orgSlug),
    listEmailTemplates(params.orgSlug),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Nova campanha</h1>
        <p className="text-sm text-muted-foreground">Escolha o canal, o público e o template.</p>
      </div>
      <NewCampaignForm
        orgSlug={params.orgSlug}
        pipelines={pipelines}
        stages={stages}
        tags={tags}
        waTemplates={waTemplates}
        emailTemplates={emailTemplates}
      />
    </div>
  )
}
