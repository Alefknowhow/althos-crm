'use client'

import dynamic from 'next/dynamic'
import type { MultiLineChartProps } from './MultiLineChartInner'

const Inner = dynamic(() => import('./MultiLineChartInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded bg-muted/40" />,
})

export default function MultiLineChart(props: MultiLineChartProps) {
  return <Inner {...props} />
}
