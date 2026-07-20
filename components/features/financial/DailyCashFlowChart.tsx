'use client'

import dynamic from 'next/dynamic'
import type { DailyCashFlowChartProps } from './DailyCashFlowChartInner'

const DailyCashFlowChartInner = dynamic(() => import('./DailyCashFlowChartInner'), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function DailyCashFlowChart(props: DailyCashFlowChartProps) {
  return <DailyCashFlowChartInner {...props} />
}
