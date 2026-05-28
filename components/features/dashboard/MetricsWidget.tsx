import { getDashboardMetrics, Period } from '@/actions/dashboard'
import MetricCards from './MetricCards'

export default async function MetricsWidget({
  orgId,
  period,
  pipelineId,
}: {
  orgId: string
  period: Period
  pipelineId?: string | null
}) {
  const metrics = await getDashboardMetrics(orgId, period, pipelineId)
  return <MetricCards metrics={metrics} />
}
