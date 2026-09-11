'use client'

// Lazy boundary: d3-geo/topojson-client/world-atlas só carregam quando o
// bloco realmente é usado — mesmo padrão de AnimatedMapBlock.tsx.
import dynamic from 'next/dynamic'
import type { ResolvedLeg } from '@/lib/geo/flightRoute'

const FlightsMapBlockInner = dynamic(() => import('./FlightsMapBlockInner'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-lg bg-muted/40" />,
})

export default function FlightsMapBlock({ legs }: { legs: ResolvedLeg[] }) {
  return <FlightsMapBlockInner legs={legs} />
}
