import { MobileCard } from './MobileCard'
import { cn } from '@/lib/utils'

/**
 * Card de KPI M3 (reformulação mobile, G3, 5.1): título curto → valor
 * principal → comparação explicada (nunca um % sem dizer a base). Nunca
 * inventa percentual quando o denominador é zero — passe `comparisonLabel`
 * como undefined nesse caso, o card mostra só o valor.
 */
export function MobileKpiCard({
  label,
  value,
  comparisonLabel,
  trend = 'neutral',
  progressPct,
  onClick,
}: {
  label: string
  value: string
  comparisonLabel?: string
  trend?: 'up' | 'down' | 'neutral'
  /** Barra de progresso opcional (ex.: Meta do mês) — clampada em [0, 100]
   *  mesmo quando o valor real (em `value`) passa de 100%. */
  progressPct?: number
  onClick?: () => void
}) {
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-m3-on-surface-variant'
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} type={onClick ? 'button' : undefined} className={cn('text-left w-full', onClick && 'active:opacity-70')}>
      <MobileCard>
        <p className="text-sm text-m3-on-surface-variant">{label}</p>
        <p className="text-2xl leading-8 font-medium tabular-nums text-m3-on-surface mt-0.5">{value}</p>
        {comparisonLabel && <p className={cn('text-sm mt-1', trendColor)}>{comparisonLabel}</p>}
        {progressPct !== undefined && (
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-m3-surface-container overflow-hidden">
            <div
              className="h-full rounded-full bg-m3-primary"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        )}
      </MobileCard>
    </Comp>
  )
}
