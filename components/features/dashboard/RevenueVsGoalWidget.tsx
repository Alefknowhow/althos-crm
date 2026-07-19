import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMetricTimeSeries, type Period } from '@/actions/dashboard'
import { getMonthlyRevenueGoal } from '@/actions/organization'
import RevenueVsGoalChart from './RevenueVsGoalChart'

export default async function RevenueVsGoalWidget({
  orgId,
  orgSlug,
  period,
  pipelineId,
  sellerId,
}: {
  orgId: string
  orgSlug: string
  period: Period
  pipelineId?: string | null
  sellerId?: string | null
}) {
  const [series, goalCents] = await Promise.all([
    getMetricTimeSeries(orgId, period, 'revenue', pipelineId, sellerId),
    getMonthlyRevenueGoal(orgSlug),
  ])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Receita vs. meta</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {goalCents
            ? 'Receita realizada no período, com a meta mensal como referência.'
            : 'Receita realizada no período. Defina uma meta mensal em Configurações → Sua Empresa para ver a linha de referência.'}
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <RevenueVsGoalChart points={series.points} goalCents={goalCents} />
      </CardContent>
    </Card>
  )
}
