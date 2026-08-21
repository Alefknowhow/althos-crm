'use client'

// Lazy boundary: recharts é pesado, mesmo padrão de MetricChart.tsx —
// só o corpo do gráfico hidrata depois do load, atrás de um skeleton de
// altura fixa (sem layout shift).
import dynamic from 'next/dynamic'
import type { ComboBarLineChartProps } from './ComboBarLineChartInner'

const ComboBarLineChartInner = dynamic(() => import('./ComboBarLineChartInner'), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function ComboBarLineChart(props: ComboBarLineChartProps) {
  return <ComboBarLineChartInner {...props} />
}
