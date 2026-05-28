import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import { getAverageTimePerStage } from '@/actions/dashboard'

function fmtDays(days: number): string {
  if (days < 1) return '< 1d'
  if (days < 30) return `${Math.round(days)}d`
  return `${(days / 30).toFixed(1)}mês`
}

/**
 * Diagnostic widget: where do leads spend time?
 *
 * Renders one row per stage with a horizontal bar scaled to the slowest
 * stage. Operator can spot the bottleneck visually — the longest bar is
 * where leads sit the most before moving on.
 */
export default async function TimeInStageWidget({
  orgId,
  pipelineId,
}: {
  orgId: string
  pipelineId: string | null
}) {
  const rows = await getAverageTimePerStage(orgId, { pipelineId, windowDays: 90 })

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Tempo por estágio
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Quanto tempo seus leads ficam em cada etapa.
          </p>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-sm text-muted-foreground">
            Dados insuficientes — precisa de algumas movimentações entre estágios.
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxAvg = Math.max(1, ...rows.map(r => r.avg_days))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Tempo médio por estágio
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Últimos 90 dias. Estágio mais demorado = gargalo do funil.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map(row => {
            const widthPct = (row.avg_days / maxAvg) * 100
            const isBottleneck = row.avg_days === maxAvg && row.avg_days > 0
            return (
              <div key={row.stage_id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: row.stage_color || '#3b82f6' }}
                    />
                    <span className="font-medium truncate">{row.stage_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-semibold">
                      {fmtDays(row.avg_days)}
                    </span>
                    <span className="text-muted-foreground text-[10px] tabular-nums">
                      mediana {fmtDays(row.median_days)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: isBottleneck
                        ? '#ef4444'
                        : row.stage_color || '#3b82f6',
                      opacity: isBottleneck ? 0.85 : 0.7,
                    }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {row.sample_size} {row.sample_size === 1 ? 'lead' : 'leads'} analisados
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
