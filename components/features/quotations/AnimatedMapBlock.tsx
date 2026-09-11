'use client'

// Lazy boundary: d3-geo/topojson-client/world-atlas só carregam quando o
// bloco realmente é usado — mesmo padrão de ComboBarLineChart.tsx.
import dynamic from 'next/dynamic'
import type { AnimatedMapRoute } from './AnimatedMapBlockInner'

const AnimatedMapBlockInner = dynamic(() => import('./AnimatedMapBlockInner'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-lg bg-muted/40" />,
})

export default function AnimatedMapBlock({ route }: { route: AnimatedMapRoute | null }) {
  return <AnimatedMapBlockInner route={route} />
}
