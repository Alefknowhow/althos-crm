import { getLeadSources, Period } from '@/actions/dashboard'
import LeadSourcesChart from './LeadSourcesChart'

export default async function LeadSourcesWidget({
  orgId,
  period,
  pipelineId,
}: {
  orgId: string
  period: Period
  pipelineId?: string | null
}) {
  const data = await getLeadSources(orgId, period, pipelineId)
  return <LeadSourcesChart data={data} />
}
