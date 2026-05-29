import { getAutomation, getAutomationRuns, getStepStats } from '@/actions/automations'
import { getForms } from '@/actions/forms'
import { getPipelinesAndStages } from '@/actions/pipeline'
import { getWaTemplates } from '@/actions/whatsapp-templates'
import AutomationEditor from '@/components/features/AutomationEditor'
import { redirect } from 'next/navigation'

/**
 * Auth + org lookup are already handled by the parent [orgSlug]/layout.tsx.
 * We use params.orgSlug directly — all action functions accept the slug and
 * do their own org lookup internally.
 */
export default async function AutomationEditorPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  const automation = await getAutomation(params.orgSlug, params.id)
  if (!automation) redirect(`/app/${params.orgSlug}/automacoes`)

  const [forms, pipelinesAndStages, runs, stepStats, waTemplates] = await Promise.all([
    getForms(params.orgSlug),
    getPipelinesAndStages(params.orgSlug),
    getAutomationRuns(params.orgSlug, automation.id),
    getStepStats(params.orgSlug, automation.id).catch(() => ({})),
    getWaTemplates(params.orgSlug).catch(() => []),
  ])

  return (
    <AutomationEditor
      orgSlug={params.orgSlug}
      automation={automation}
      forms={forms}
      stages={pipelinesAndStages.stages}
      runs={runs}
      stepStats={stepStats}
      whatsappTemplates={waTemplates}
    />
  )
}
