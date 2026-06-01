'use client'

import { formatCurrency } from '@/lib/utils'
import { Wallet, Briefcase, Calculator, AlarmClock, Flame } from 'lucide-react'

type Lead = {
  value_cents?: number | null
  last_activity_at?: string | null
  updated_at?: string | null
  ai_tier?: string | null
}

const STALL_MS = 7 * 24 * 60 * 60 * 1000

function isStalled(l: Lead): boolean {
  const ref = l.last_activity_at || l.updated_at
  if (!ref) return false
  return Date.now() - new Date(ref).getTime() > STALL_MS
}

export default function PipelineKpiBar({ leads }: { leads: Lead[] }) {
  const count = leads.length
  const totalCents = leads.reduce((a, l) => a + (l.value_cents || 0), 0)
  const withValue = leads.filter(l => (l.value_cents || 0) > 0).length
  const avgCents = withValue ? Math.round(totalCents / withValue) : 0
  const stalled = leads.filter(isStalled).length
  const hot = leads.filter(l => (l.ai_tier || '').toLowerCase() === 'hot' || (l.ai_tier || '').toLowerCase() === 'quente').length

  const items = [
    {
      label: 'Valor em aberto',
      value: formatCurrency(totalCents),
      icon: Wallet,
      tone: 'text-brand-600 bg-brand-50',
    },
    {
      label: 'Negócios ativos',
      value: String(count),
      icon: Briefcase,
      tone: 'text-sky-600 bg-sky-50',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(avgCents),
      icon: Calculator,
      tone: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Parados +7d',
      value: String(stalled),
      icon: AlarmClock,
      tone: stalled > 0 ? 'text-amber-600 bg-amber-50' : 'text-muted-foreground bg-secondary',
    },
    {
      label: 'Quentes (IA)',
      value: String(hot),
      icon: Flame,
      tone: hot > 0 ? 'text-rose-600 bg-rose-50' : 'text-muted-foreground bg-secondary',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(item => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="truncate text-base font-semibold tabular-nums tracking-apple-tight">
                {item.value}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
