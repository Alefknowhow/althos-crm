'use client'

// Lazy boundary: recharts (~heavy) is deferred off the dashboard's initial
// render. The Card + title are still rendered immediately; only the chart body
// hydrates in after load, behind a fixed-height skeleton (no layout shift).
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeadSourcesChartProps } from './LeadSourcesChartInner'

const LeadSourcesChartInner = dynamic(() => import('./LeadSourcesChartInner'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded-xl bg-muted/40" />,
})

export default function LeadSourcesChart({ data }: LeadSourcesChartProps) {
  return (
    <Card className="reveal">
      <CardHeader className="pb-2">
        <CardTitle className="text-base tracking-apple-tighter">Origens dos leads</CardTitle>
      </CardHeader>
      <CardContent>
        <LeadSourcesChartInner data={data} />
      </CardContent>
    </Card>
  )
}
