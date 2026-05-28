'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Period } from '@/actions/dashboard'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

export default function PeriodFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentPeriod = (searchParams.get('period') as Period) || '30d'

  const handlePeriodChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={currentPeriod} onValueChange={handlePeriodChange}>
      <TabsList className="rounded-full bg-secondary p-1 h-auto gap-0.5">
        {PERIODS.map(p => (
          <TabsTrigger
            key={p.value}
            value={p.value}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium tracking-apple-snug data-[state=active]:bg-background data-[state=active]:shadow-apple-sm transition-all duration-200 ease-apple"
          >
            {p.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
