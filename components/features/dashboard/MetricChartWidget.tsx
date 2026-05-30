import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMetricTimeSeries, type DashboardMetric, type Period } from '@/actions/dashboard'
import MetricSelect from './MetricSelect'
import MetricChart from './MetricChart'

function fmtTotal(v: number, format: 'number' | 'currency'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  }
  return new Intl.NumberFormat('pt-BR').format(v || 0)
}

/** Main dashboard chart with a user-selectable indicator (leads, revenue,
 *  sales, appointments). The selected metric is read from the URL so the
 *  whole widget re-renders server-side on change. */
export default async function MetricChartWidget({
  orgId,
  period,
  metric,
  pipelineId,
}: {
  orgId: string
  period: Period
  metric: DashboardMetric
  pipelineId?: string | null
}) {
  const series = await getMetricTimeSeries(orgId, period, metric, pipelineId)

  return (
    <Card className="reveal">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base tracking-apple-tighter">{series.label} ao longo do tempo</CardTitle>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: series.color }}>
              {fmtTotal(series.total, series.format)}
              <span className="text-xs font-normal text-muted-foreground ml-2">no período</span>
            </p>
          </div>
          <MetricSelect />
        </div>
      </CardHeader>
      <CardContent>
        <MetricChart
          points={series.points}
          color={series.color}
          format={series.format}
          label={series.label}
        />
      </CardContent>
    </Card>
  )
}
