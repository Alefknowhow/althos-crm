'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, TrendingDown, TrendingUp, Info, X, Sparkles, Loader2 } from 'lucide-react'
import { dismissInsight, generateInsightsNow, type DashboardInsight } from '@/actions/dashboard-insights'
import { Button } from '@/components/ui/button'
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
  const router = useRouter()
  const [insights, setInsights] = useState(initialInsights)
  const [isPending, startTransition] = useTransition()

  function handleDismiss(id: string) {
    setInsights(prev => prev.filter(i => i.id !== id))
    startTransition(() => { dismissInsight(orgSlug, id) })
  }

  function handleGenerate() {
    startTransition(async () => {
      await generateInsightsNow(orgSlug)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 rounded-full text-xs gap-1.5"
        disabled={isPending}
        onClick={handleGenerate}
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {insights.length === 0 ? 'Gerar Insights' : 'Atualizar'}
      </Button>
    </div>
  )
}
