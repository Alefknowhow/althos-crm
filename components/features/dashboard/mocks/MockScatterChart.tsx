'use client'

import dynamic from 'next/dynamic'
export type { MockScatterPoint } from './MockScatterChartInner'
import type { MockScatterPoint } from './MockScatterChartInner'

const MockScatterChartInner = dynamic(() => import('./MockScatterChartInner'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-xl bg-muted/40" />,
})

export default function MockScatterChart({ points }: { points: MockScatterPoint[] }) {
  return <MockScatterChartInner points={points} />
}
