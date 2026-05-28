import { getLeadsTimeSeries, Period } from '@/actions/dashboard'
import LeadsTimeSeriesChart from './LeadsTimeSeriesChart'

export default async function TimeSeriesWidget({
  orgId,
  period,
  pipelineId,
}: {
  orgId: string
  period: Period
  pipelineId?: string | null
}) {
  const data = await getLeadsTimeSeries(orgId, period, pipelineId)
  return <LeadsTimeSeriesChart data={data} />
}
