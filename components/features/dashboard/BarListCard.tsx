import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMPACT_CARD_H } from './dashboardSizes'

export type BarRow = {
  label: string
  value: number
  valueLabel: string
  /** Texto secundário ao lado do valor (ex.: "12 vendas"). */
  sublabel?: string
  /** Sobrescreve a cor da barra desta linha (ex.: destacar acima da média). */
  color?: string
  /** Selo de destaque ao lado do rótulo (ex.: "acima da média"). */
  highlight?: string
}

/**
 * Ranking em barras horizontais (dado real). Altura fixa (`heightClass`,
 * padrão COMPACT_CARD_H) — o que não cabe rola dentro do card.
 * `referenceValue` desenha uma linha vertical tracejada de referência
 * (ex.: média) em cada trilho.
 */
export default function BarListCard({
  title,
  help,
  icon: Icon,
  rows,
  color = '#8d8d8d',
  emptyText = 'Sem dados no período.',
  heightClass = COMPACT_CARD_H,
  referenceValue,
  referenceLabel,
  maxValue: maxOverride,
  action,
}: {
  title: string
  help: string
  icon?: LucideIcon
  rows: BarRow[]
  color?: string
  emptyText?: string
  heightClass?: string
  referenceValue?: number
  referenceLabel?: string
  maxValue?: number
  action?: React.ReactNode
}) {
  const maxValue = maxOverride ?? Math.max(1, ...rows.map(r => r.value), referenceValue ?? 0)

  return (
    <Card className={cn(heightClass, 'flex flex-col overflow-hidden min-w-0')}>
      <CardHeader className="pb-2 shrink-0 space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color }} />}
              <span className="truncate">{title}</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{help}</p>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-3 pr-1">
            {rows.map(r => (
              <div key={r.label} className="group" title={`${r.label}: ${r.valueLabel}${r.sublabel ? ` · ${r.sublabel}` : ''}`}>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className={cn('truncate', r.highlight ? 'font-semibold' : 'font-medium')}>
                    {r.label}
                    {r.highlight && (
                      <span className="ml-1.5 rounded-sm bg-warning/15 text-warning px-1 py-px text-[10px] font-medium">{r.highlight}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {r.valueLabel}
                    {r.sublabel && <span className="ml-1.5 text-muted-foreground font-normal">{r.sublabel}</span>}
                  </span>
                </div>
                <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
                    style={{ width: `${Math.max(0, Math.min(100, (r.value / maxValue) * 100))}%`, backgroundColor: r.color || color }}
                  />
                  {referenceValue !== undefined && referenceValue > 0 && (
                    <div
                      className="absolute top-0 bottom-0 border-l border-dashed border-foreground/50"
                      style={{ left: `${Math.min(100, (referenceValue / maxValue) * 100)}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
            {referenceValue !== undefined && referenceValue > 0 && referenceLabel && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                <span className="inline-block w-3 border-t border-dashed border-foreground/50" /> {referenceLabel}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
