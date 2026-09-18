import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingDown } from 'lucide-react'
import { COMPACT_CARD_H, LIST_SCROLL_H } from './dashboardSizes'
import type { LossReasonBySourceRow } from '@/actions/dashboard-tabs'

// Mesma paleta de --chart-N usada no funil (ConversionFunnelWidget) —
// cor por origem é estável entre linhas (a mesma origem sempre tem a
// mesma cor), diferente do funil onde a cor é só por posição.
const SOURCE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']

/**
 * Motivos de perda — uma linha por motivo, com a barra segmentada por
 * origem do lead (cada origem sempre com a mesma cor entre as linhas) e o
 * total + % do motivo sobre todas as perdas do período ao final da linha.
 * O comprimento total da barra é proporcional ao motivo mais frequente,
 * então dá pra comparar magnitude entre motivos E composição por origem
 * dentro de cada um.
 */
export default function LossReasonsBySourceWidget({ rows }: { rows: LossReasonBySourceRow[] }) {
  const maxCount = Math.max(1, ...rows.map(r => r.count))
  const sources = Array.from(new Set(rows.flatMap(r => r.bySource.map(s => s.source))))
  const colorBySource = new Map(sources.map((s, i) => [s, SOURCE_COLORS[i % SOURCE_COLORS.length]]))

  return (
    <Card className={`${COMPACT_CARD_H} flex flex-col`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="w-4 h-4" style={{ color: '#da1e28' }} />
          Motivos de perda
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Motivo informado ao mover um lead para perdido/desqualificado, segmentado por origem do lead.
        </p>
      </CardHeader>
      <CardContent className={`${LIST_SCROLL_H} overflow-y-auto shrink-0`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum motivo de perda registrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {sources.length > 1 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 pb-1">
                {sources.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorBySource.get(s) }} />
                    {s}
                  </span>
                ))}
              </div>
            )}
            {rows.map(r => (
              <div key={r.reason}>
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <span className="font-medium truncate">{r.reason}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {r.count} · {r.pct.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-2 bg-muted/40 rounded-full overflow-hidden flex"
                  style={{ width: `${(r.count / maxCount) * 100}%` }}
                >
                  {r.bySource.map(seg => (
                    <div
                      key={seg.source}
                      className="h-full opacity-80"
                      title={`${seg.source}: ${seg.count}`}
                      style={{ width: `${(seg.count / r.count) * 100}%`, backgroundColor: colorBySource.get(seg.source) }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
