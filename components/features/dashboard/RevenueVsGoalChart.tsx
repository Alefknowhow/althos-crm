'use client'

import dynamic from 'next/dynamic'
import type { RevenueVsGoalChartProps } from './RevenueVsGoalChartInner'

const RevenueVsGoalChartInner = dynamic(() => import('./RevenueVsGoalChartInner'), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-xl bg-muted/40" />,
})

export default function RevenueVsGoalChart(props: RevenueVsGoalChartProps) {
  return <RevenueVsGoalChartInner {...props} />
}
