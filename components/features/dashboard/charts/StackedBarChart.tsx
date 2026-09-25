'use client'

import dynamic from 'next/dynamic'
import type { StackedBarChartProps } from './StackedBarChartInner'

const Inner = dynamic(() => import('./StackedBarChartInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded bg-muted/40" />,
})

export default function StackedBarChart(props: StackedBarChartProps) {
  return <Inner {...props} />
}
