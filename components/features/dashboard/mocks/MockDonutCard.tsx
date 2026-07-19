import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import MockBadge from '../MockBadge'

export type MockSegment = { label: string; pct: number; color: string }

export default function MockDonutCard({
  title,
  help,
  icon: Icon,
  segments,
}: {
  title: string
  help: string
  icon?: LucideIcon
  segments: MockSegment[]
}) {
  let acc = 0
  const stops = segments
    .map(s => {
      const from = acc
      acc += s.pct
      return `${s.color} ${from}% ${acc}%`
    })
    .join(', ')

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            {title}
          </CardTitle>
          <MockBadge />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{help}</p>
      </CardHeader>
      <CardContent className="flex-1 flex items-center gap-6">
        <div
          className="w-24 h-24 rounded-full shrink-0"
          style={{ background: `conic-gradient(${stops})` }}
        >
          <div className="w-14 h-14 rounded-full bg-card m-[17px]" />
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          {segments.map(s => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="truncate flex-1">{s.label}</span>
              <span className="font-medium tabular-nums">{s.pct}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
