'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, TrendingDown, TrendingUp, Info, X } from 'lucide-react'
import { dismissInsight, type DashboardInsight } from '@/actions/dashboard-insights'
import { cn } from '@/lib/utils'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'alert-triangle': AlertTriangle,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
}

const KIND_STYLES: Record<DashboardInsight['kind'], string> = {
  risk: 'border-red-300/60 bg-red-500/5 text-red-700 dark:text-red-400',
  opportunity: 'border-emerald-300/60 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
  info: 'border-border bg-muted/40 text-foreground',
}

export default function InsightsStrip({
  orgSlug,
  initialInsights,
}: {
  orgSlug: string
  initialInsights: DashboardInsight[]
}) {
  const [insights, setInsights] = useState(initialInsights)
  const [, startTransition] = useTransition()

  if (insights.length === 0) return null

  function handleDismiss(id: string) {
    setInsights(prev => prev.filter(i => i.id !== id))
    startTransition(() => { dismissInsight(orgSlug, id) })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {insights.map(insight => {
        const Icon = (insight.icon && ICONS[insight.icon]) || Info
        const href = `/app/${orgSlug}${insight.deep_link || ''}`
        return (
          <div
            key={insight.id}
            className={cn(
              'group flex items-center gap-2 rounded-full border pl-3 pr-2 py-1.5 text-xs font-medium',
              KIND_STYLES[insight.kind],
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{insight.text}</span>
            <Link href={href} className="underline underline-offset-2 shrink-0 hover:opacity-80">
              ver
            </Link>
            <button
              type="button"
              onClick={() => handleDismiss(insight.id)}
              className="shrink-0 opacity-50 hover:opacity-100"
              aria-label="Dispensar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
