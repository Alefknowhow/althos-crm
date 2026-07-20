'use client'

import dynamic from 'next/dynamic'
import type { CashFlowChartProps } from './CashFlowChartInner'

const CashFlowChartInner = dynamic(() => import('./CashFlowChartInner'), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function CashFlowChart(props: CashFlowChartProps) {
  return <CashFlowChartInner {...props} />
}
