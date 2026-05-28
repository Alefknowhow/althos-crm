import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Compass, Trophy } from 'lucide-react'
import { getSourcePerformance } from '@/actions/dashboard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

/**
 * "Where do my conversions REALLY come from?" — for each origin, show
 * leads vs won + conversion %. Sorted by total won value first so the
 * top of the list = your most profitable channels.
 */
export default async function SourcePerformanceWidget({
  orgId,
  pipelineId,
}: {
  orgId: string
  pipelineId: string | null
}) {
  const rows = await getSourcePerformance(orgId, { pipelineId, windowDays: 90 })

  // Max for relative bar scaling.
  const maxValue = Math.max(1, ...rows.map(r => r.total_value_cents))
  const bestSourceIdx = rows.length > 0
    ? rows.findIndex(r => r.total_value_cents === maxValue)
    : -1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-600" />
          Performance por Origem
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Últimos 90 dias. Quem traz lead bom (não só lead).
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sem dados nos últimos 90 dias.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r, idx) => {
              const widthPct = (r.total_value_cents / maxValue) * 100
              const isBest = idx === bestSourceIdx && r.total_value_cents > 0
              return (
                <div key={r.source}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isBest && <Trophy className="w-3 h-3 text-amber-500 shrink-0" />}
                      <span className="font-medium truncate" title={r.source}>
                        {r.source}
                      </span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2 tabular-nums text-[10px]">
                      {r.won}/{r.leads} ·{' '}
                      <strong
                        className={
                          r.conversion_pct >= 30
                            ? 'text-emerald-600'
                            : r.conversion_pct >= 10
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                        }
                      >
                        {r.conversion_pct.toFixed(1)}%
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: isBest ? '#f59e0b' : '#3b82f6',
                          opacity: isBest ? 0.85 : 0.7,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-20 text-right">
                      {fmtCurrency(r.total_value_cents)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
