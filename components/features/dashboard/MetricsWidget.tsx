import { getDashboardMetrics, Period } from '@/actions/dashboard'
import MetricCards from './MetricCards'

export default async function MetricsWidget({
  orgId,
  period,
  pipelineId,
  sellerId,
}: {
  orgId: string
  period: Period
  pipelineId?: string | null
  sellerId?: string | null
}) {
  const metrics = await getDashboardMetrics(orgId, period, pipelineId, sellerId)
  return <MetricCards metrics={metrics} />
}
