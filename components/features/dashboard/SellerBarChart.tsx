'use client'

import dynamic from 'next/dynamic'
import type { SellerBarChartProps } from './SellerBarChartInner'

const SellerBarChartInner = dynamic(() => import('./SellerBarChartInner'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function SellerBarChart(props: SellerBarChartProps) {
  return <SellerBarChartInner {...props} />
}
