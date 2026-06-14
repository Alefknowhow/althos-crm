'use client'

// Lazy boundary: recharts (~heavy) is deferred off the dashboard's initial
// render. The card + title are still SSR'd by MetricChartWidget; only the chart
// body hydrates in after load, behind a fixed-height skeleton (no layout shift).
import dynamic from 'next/dynamic'
import type { MetricChartProps } from './MetricChartInner'

const MetricChartInner = dynamic(() => import('./MetricChartInner'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded-xl bg-muted/40" />,
})

export default function MetricChart(props: MetricChartProps) {
  return <MetricChartInner {...props} />
}
