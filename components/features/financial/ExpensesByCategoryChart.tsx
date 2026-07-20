'use client'

import dynamic from 'next/dynamic'
import type { ExpensesByCategoryChartProps } from './ExpensesByCategoryChartInner'

const ExpensesByCategoryChartInner = dynamic(() => import('./ExpensesByCategoryChartInner'), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full animate-pulse rounded-none bg-muted/40" />,
})

export default function ExpensesByCategoryChart(props: ExpensesByCategoryChartProps) {
  return <ExpensesByCategoryChartInner {...props} />
}
