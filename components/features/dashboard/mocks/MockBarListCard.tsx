import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import MockBadge from '../MockBadge'

export type MockBarRow = { label: string; value: number; valueLabel: string }

export default function MockBarListCard({
  title,
  help,
  icon: Icon,
  rows,
  color = '#8d8d8d',
}: {
  title: string
  help: string
  icon?: LucideIcon
  rows: MockBarRow[]
  color?: string
}) {
  const maxValue = Math.max(1, ...rows.map(r => r.value))

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4" style={{ color }} />}
            {title}
          </CardTitle>
          <MockBadge />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{help}</p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
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
      </CardContent>
    </Card>
  )
}
