import { getAutomations } from '@/actions/automations'
import AutomationsListGrid, { type AutomationListItem } from '@/components/features/automations/AutomationsListGrid'

export default async function AutomacoesIndexPage({ params }: { params: { orgSlug: string } }) {
  // getAutomations is safe: returns [] on any error, never throws.
  const automations = await getAutomations(params.orgSlug)

  const items: AutomationListItem[] = automations.map((a: any) => ({
    id: a.id,
    name: a.name,
    is_active: a.is_active,
    trigger_type: a.trigger_type,
    steps: a.steps || [],
    runsThisMonth: a.runsThisMonth || 0,
  }))

  return <AutomationsListGrid orgSlug={params.orgSlug} automations={items} />
}
