'use client'

// Lazy boundary: recharts (~heavy) is deferred off the dashboard's initial
// render. The Card + title are still rendered immediately; only the chart body
// hydrates in after load, behind a fixed-height skeleton (no layout shift).
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeadsTimeSeriesChartProps } from './LeadsTimeSeriesChartInner'

const LeadsTimeSeriesChartInner = dynamic(() => import('./LeadsTimeSeriesChartInner'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function LeadsTimeSeriesChart({ data }: LeadsTimeSeriesChartProps) {
  return (
    <Card className="col-span-1 lg:col-span-2 reveal">
      <CardHeader className="pb-2">
        <CardTitle className="text-base tracking-apple-tighter">Leads ao longo do tempo</CardTitle>
      </CardHeader>
      <CardContent>
        <LeadsTimeSeriesChartInner data={data} />
      </CardContent>
    </Card>
  )
}
