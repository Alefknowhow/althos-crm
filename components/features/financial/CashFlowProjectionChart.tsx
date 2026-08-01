'use client'

import dynamic from 'next/dynamic'
import type { CashFlowProjectionChartProps } from './CashFlowProjectionChartInner'

const CashFlowProjectionChartInner = dynamic(() => import('./CashFlowProjectionChartInner'), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function CashFlowProjectionChart(props: CashFlowProjectionChartProps) {
  return <CashFlowProjectionChartInner {...props} />
}
