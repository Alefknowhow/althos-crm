import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import { COMPACT_CARD_H, LIST_SCROLL_H } from './dashboardSizes'

export type RankRow = { label: string; subLabel?: string; value: number; valueLabel: string }

/**
 * Rank posicionado (1º, 2º, 3º...) com mini-barra de progresso — mesmo
 * espírito de BarListCard, mas com posição numerada + subtítulo por linha,
 * usado nos ranks de clientes/destinos/produtos.
 */
export default function RankTable({
  title, help, icon: Icon, rows, color = '#8d8d8d', emptyText = 'Sem dados no período.',
}: {
  title: string
  help: string
  icon?: LucideIcon
  rows: RankRow[]
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
            {rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="flex items-start gap-2.5">
                <span className="text-xs font-semibold text-muted-foreground w-4 shrink-0 mt-0.5 tabular-nums">{i + 1}º</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs mb-1 gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.label}</div>
                      {r.subLabel && <div className="text-[11px] text-muted-foreground truncate">{r.subLabel}</div>}
                    </div>
                    <span className="text-muted-foreground shrink-0 tabular-nums">{r.valueLabel}</span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full opacity-70"
                      style={{ width: `${(r.value / maxValue) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
