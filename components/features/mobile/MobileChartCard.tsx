'use client'

import { useState } from 'react'
import { MobileCard } from './MobileCard'
import { MobileBottomSheet } from './MobileBottomSheet'
import { cn } from '@/lib/utils'

/**
 * Card de gráfico compacto M3 (spec mobile G3/5.1): título → valor +
 * período → comparação → gráfico → "Ver detalhes". O `chart` passado é o
 * plot em si (Recharts ResponsiveContainer já dimensionado pelo caller,
 * 140-180px de altura por padrão da spec) — este componente não sabe nada
 * de Recharts, só compõe o entorno editorial em volta.
 *
 * `expanded` (o mesmo gráfico em versão maior, opcional) abre num bottom
 * sheet ao tocar em "Ver detalhes" — se omitido, o botão não aparece.
 */
export function MobileChartCard({
  title,
  value,
  period,
  comparisonLabel,
  trend = 'neutral',
  chart,
  expanded,
  updatedAt,
}: {
  title: string
  value?: string
  period?: string
  comparisonLabel?: string
  trend?: 'up' | 'down' | 'neutral'
  chart: React.ReactNode
  expanded?: React.ReactNode
  updatedAt?: string
}) {
  const [open, setOpen] = useState(false)
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-m3-on-surface-variant'

  return (
    <MobileCard className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-m3-on-surface">{title}</p>
        {period && <p className="text-xs text-m3-on-surface-variant shrink-0">{period}</p>}
      </div>
      {value && <p className="text-2xl leading-8 font-medium tabular-nums text-m3-on-surface">{value}</p>}
      {comparisonLabel && <p className={cn('text-sm', trendColor)}>{comparisonLabel}</p>}

      <div className="h-[160px]">{chart}</div>

      <div className="flex items-center justify-between pt-1">
        {updatedAt ? <p className="text-xs text-m3-on-surface-variant">Atualizado {updatedAt}</p> : <span />}
        {expanded && (
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-m3-primary min-h-[48px] px-2 -mr-2">
            Ver detalhes
          </button>
        )}
      </div>

      {expanded && (
        <MobileBottomSheet open={open} onOpenChange={setOpen} title={title}>
          <p className="text-base font-medium text-m3-on-surface mb-3">{title}</p>
          {expanded}
        </MobileBottomSheet>
      )}
    </MobileCard>
  )
}
