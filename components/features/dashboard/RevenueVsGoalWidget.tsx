import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRevenueCommissionSeries, type Period } from '@/actions/dashboard'
import RevenueVsGoalChart from './RevenueVsGoalChart'
import { CHART_CARD_H } from './dashboardSizes'

export default async function RevenueVsGoalWidget({
  orgId,
  period,
  sellerId,
}: {
  orgId: string
  orgSlug: string
  period: Period
  pipelineId?: string | null
  sellerId?: string | null
}) {
  const { points, hasCommission } = await getRevenueCommissionSeries(orgId, period, sellerId)

  return (
    <Card className={`${CHART_CARD_H} flex flex-col overflow-hidden`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base">Receita x Comissão</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {hasCommission
            ? 'Receita e comissão acumuladas no período.'
            : 'Receita acumulada no período.'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <RevenueVsGoalChart points={points} hasCommission={hasCommission} />
      </CardContent>
    </Card>
  )
}
