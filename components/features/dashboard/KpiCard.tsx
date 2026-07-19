'use client'

import { useId } from 'react'
import { Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import MockBadge from './MockBadge'

type Trend = 'up' | 'down' | 'neutral'

export default function KpiCard({
  label,
  value,
  help,
  trend,
  trendLabel,
  mock,
  className,
}: {
  label: string
  value: string
  help: string
  trend?: Trend
  trendLabel?: string
  mock?: boolean
  className?: string
}) {
  const helpId = useId()
  const trendColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  return (
    <Card className={cn('flex flex-col justify-between p-4 h-full', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-describedby={helpId}
                className="shrink-0 text-muted-foreground/70 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="sr-only">O que é {label}?</span>
              </button>
            </TooltipTrigger>
            <TooltipContent id={helpId} className="max-w-[240px] text-left">
              {help}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="mt-2">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {trendLabel && <div className={cn('text-[11px] mt-0.5', trendColor)}>{trendLabel}</div>}
      </div>
      {mock && (
        <div className="mt-2">
          <MockBadge />
        </div>
      )}
    </Card>
  )
}
