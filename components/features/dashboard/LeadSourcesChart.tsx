import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LeadSourcesChartInner, { type LeadSourcesChartProps } from './LeadSourcesChartInner'
import { COMPACT_CARD_H } from './dashboardSizes'

export default function LeadSourcesChart({ data }: LeadSourcesChartProps) {
  return (
    <Card className={`reveal ${COMPACT_CARD_H} flex flex-col overflow-hidden`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base tracking-apple-tighter">Origens dos leads</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <LeadSourcesChartInner data={data} />
      </CardContent>
    </Card>
  )
}
