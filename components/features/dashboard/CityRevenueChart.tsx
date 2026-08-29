'use client'

import dynamic from 'next/dynamic'
import type { CityRevenueChartProps } from './CityRevenueChartInner'

const CityRevenueChartInner = dynamic(() => import('./CityRevenueChartInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function CityRevenueChart(props: CityRevenueChartProps) {
  return <CityRevenueChartInner {...props} />
}
