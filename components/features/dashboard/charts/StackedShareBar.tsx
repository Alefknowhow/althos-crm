import { fmtPct } from '@/lib/dashboard/format'

export type ShareSegment = { label: string; value: number; valueLabel: string; color: string }

/**
 * Barra horizontal empilhada 100% (participação) + legenda com valores.
 * Usada para Mix de vendas e Segmentação da base — substitui pizza.
 * Segmentos separados por 2px de superfície; rótulo direto dentro do
 * segmento quando ele tem largura suficiente.
 */
export default function StackedShareBar({ segments, barHeight = 'h-10' }: { segments: ShareSegment[]; barHeight?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const visible = segments.filter(s => s.value > 0)
  return (
    <div className="space-y-3">
      <div className={`flex w-full ${barHeight} rounded-md overflow-hidden bg-muted/50`} role="img" aria-label="Participação por categoria">
        {visible.map(s => {
          const pct = total > 0 ? (s.value / total) * 100 : 0
          return (
            <div
              key={s.label}
              title={`${s.label}: ${s.valueLabel} (${fmtPct(pct, 1)})`}
              className="h-full flex items-center justify-center text-[11px] font-semibold text-white border-r-2 border-card last:border-r-0 hover:brightness-110 transition cursor-default overflow-hidden"
              style={{ width: `${pct}%`, backgroundColor: s.color }}
            >
              {pct >= 8 ? fmtPct(pct) : ''}
            </div>
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segments.map(s => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{s.valueLabel}</span>
            <span className="text-muted-foreground tabular-nums">({fmtPct(total > 0 ? (s.value / total) * 100 : 0)})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
