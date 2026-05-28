import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getAutomation, getAutomationRuns } from '@/actions/automations'
import { getForms } from '@/actions/forms'
import { getPipelinesAndStages } from '@/actions/pipeline'
import AutomationEditor from '@/components/features/AutomationEditor'
import { redirect } from 'next/navigation'

export default async function AutomationEditorPage({ params }: { params: { orgSlug: string, id: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const automation = await getAutomation(org.slug, params.id)
  
  if (!automation) redirect(`/app/${org.slug}/automacoes`)

  const [forms, pipelinesAndStages, runs] = await Promise.all([
    getForms(org.slug),
    getPipelinesAndStages(org.slug),
    getAutomationRuns(org.slug, automation.id),
  ])
  const { stages } = pipelinesAndStages

  return (
    <div className="h-full bg-muted/20">
      <AutomationEditor 
        orgSlug={org.slug} 
        automation={automation} 
        forms={forms} 
        stages={stages} 
        runs={runs}
      />
    </div>
  )
}
