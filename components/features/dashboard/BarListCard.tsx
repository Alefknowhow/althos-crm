import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import { COMPACT_CARD_H, LIST_SCROLL_H } from './dashboardSizes'

export type BarRow = { label: string; value: number; valueLabel: string }

/** Variante real (sem MockBadge) de MockBarListCard — mesmo visual, pra dado de verdade. */
export default function BarListCard({
  title,
  help,
  icon: Icon,
  rows,
  color = '#8d8d8d',
  emptyText = 'Sem dados no período.',
}: {
  title: string
  help: string
  icon?: LucideIcon
  rows: BarRow[]
  color?: string
  emptyText?: string
}) {
  const maxValue = Math.max(1, ...rows.map(r => r.value))

  return (
    <Card className={`${COMPACT_CARD_H} flex flex-col`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" style={{ color }} />}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{help}</p>
      </CardHeader>
      <CardContent className={`${LIST_SCROLL_H} overflow-y-auto shrink-0`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{r.label}</span>
                  <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">{r.valueLabel}</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full opacity-70"
                    style={{ width: `${(r.value / maxValue) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
