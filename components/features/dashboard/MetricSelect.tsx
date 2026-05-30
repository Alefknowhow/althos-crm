'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Kept in sync with DASHBOARD_METRICS in actions/dashboard.ts. Defined locally
// (not imported) so this client component doesn't pull the server-only actions
// module — and its next/headers dependency — into the browser bundle.
const METRICS: { value: string; label: string }[] = [
  { value: 'leads',        label: 'Novos leads' },
  { value: 'revenue',      label: 'Receita' },
  { value: 'sales',        label: 'Vendas' },
  { value: 'appointments', label: 'Agendamentos' },
]

/** Dropdown that picks which indicator the main dashboard chart plots.
 *  Mirrors PeriodFilter: writes the choice to the `metric` URL param so the
 *  server widget refetches with the new series. */
export default function MetricSelect() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const current = searchParams.get('metric') || 'leads'

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('metric', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[170px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {METRICS.map(m => (
          <SelectItem key={m.value} value={m.value} className="text-xs">
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
