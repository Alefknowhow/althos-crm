'use client'

// Lazy boundary (mesmo padrão de ComboBarLineChart.tsx): Recharts só no client.
import dynamic from 'next/dynamic'
import type { BarLineChartProps } from './BarLineChartInner'

const Inner = dynamic(() => import('./BarLineChartInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded bg-muted/40" />,
})

export default function BarLineChart(props: BarLineChartProps) {
  return <Inner {...props} />
}
