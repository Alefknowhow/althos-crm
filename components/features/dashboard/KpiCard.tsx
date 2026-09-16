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
  compact,
  icon,
}: {
  label: string
  value: string
  help: string
  trend?: Trend
  trendLabel?: string
  mock?: boolean
  className?: string
  /** Versão menor — pra caber várias lado a lado numa linha só (ex.: Indicadores estratégicos). */
  compact?: boolean
  /** Ícone opcional (já renderizado, ex. `<DollarSign />`) — chip circular
   *  tintado no canto superior direito, como no /design. Recebe o elemento
   *  já montado (não o componente) porque KpiCard é client e a maioria dos
   *  call sites são Server Components — passar a referência do componente
   *  (em vez do elemento já renderizado) quebra a serialização RSC. */
  icon?: React.ReactNode
}) {
  const helpId = useId()
  const trendColor =
    trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'

  return (
    <Card className={cn(
      'flex flex-col justify-between min-w-0',
      compact ? 'p-2 h-full min-h-[76px]' : 'p-2.5 sm:p-4 h-full min-h-[100px] sm:min-h-[108px]',
      className,
    )}>
      <div className="flex items-start justify-between gap-1.5">
        <span className={cn('font-medium text-muted-foreground truncate', compact ? 'text-[10px]' : 'text-xs sm:text-[13px]')}>{label}</span>
        {icon ? (
          <span className={cn(
            'shrink-0 grid place-items-center rounded-full bg-primary/12 text-primary [&_svg]:shrink-0',
            compact ? 'w-5 h-5 [&_svg]:w-3 [&_svg]:h-3' : 'w-7 h-7 [&_svg]:w-3.5 [&_svg]:h-3.5',
          )}>
            {icon}
          </span>
        ) : (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-describedby={helpId}
                  className="hidden sm:inline-flex shrink-0 text-muted-foreground/70 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
                >
                  <Info className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                  <span className="sr-only">O que é {label}?</span>
                </button>
              </TooltipTrigger>
              <TooltipContent id={helpId} className="max-w-[240px] text-left">
                {help}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className={cn('min-w-0', compact ? 'mt-0.5' : 'mt-1 sm:mt-2')}>
        <div className={cn('font-bold tabular-nums truncate', compact ? 'text-sm' : 'text-base sm:text-2xl')}>{value}</div>
        {trendLabel && <div className={cn('mt-0.5 truncate', compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]', trendColor)}>{trendLabel}</div>}
      </div>
      {mock && (
        <div className={compact ? 'mt-1' : 'mt-2'}>
          <MockBadge />
        </div>
      )}
    </Card>
  )
}
