import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Trophy } from 'lucide-react'
import { getRevenueForecast } from '@/actions/dashboard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

/**
 * Revenue forecast: sum of (current pipeline value × probability of close).
 * Probability is learned from the last 90 days when there's enough data,
 * falls back to position-based weights otherwise.
 *
 * Shows operator: how much you've already won + how much you're likely
 * to close = your realistic month total.
 */
export default async function RevenueForecastWidget({
  orgId,
  pipelineId,
}: {
  orgId: string
  pipelineId: string | null
}) {
  const forecast = await getRevenueForecast(orgId, { pipelineId })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          Forecast de receita
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Já ganho + projeção do pipeline ponderada por probabilidade.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Big number */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200 dark:border-emerald-800">
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-medium">
            Projeção combinada (mês)
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-emerald-900 dark:text-emerald-100">
            {fmtCurrency(forecast.combined_forecast_cents)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-emerald-800 dark:text-emerald-200">
            <span className="inline-flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              Já ganho:{' '}
              <strong className="tabular-nums">
                {fmtCurrency(forecast.already_won_cents)}
              </strong>
            </span>
            <span>+</span>
            <span>
              Esperado:{' '}
              <strong className="tabular-nums">
                {fmtCurrency(forecast.total_expected_cents)}
              </strong>
            </span>
          </div>
        </div>

        {/* Per-stage breakdown */}
        {forecast.stages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sem dados no pipeline pra projetar.
          </p>
        ) : (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Por estágio
            </div>
            <div className="space-y-2">
              {forecast.stages.map(row => (
                <div key={row.stage_id} className="text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: row.stage_color || '#3b82f6' }}
                      />
                      <span className="font-medium">{row.stage_name}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {(row.probability * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground">
                        {fmtCurrency(row.pipeline_value_cents)}
                      </span>
                      <span className="text-emerald-600 font-semibold">
                        → {fmtCurrency(row.expected_value_cents)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/60 transition-all"
                      style={{ width: `${row.probability * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {row.lead_count} lead{row.lead_count !== 1 ? 's' : ''} no estágio
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground border-t pt-3">
          Probabilidades aprendidas dos últimos 90 dias. Estágios com pouco histórico usam
          peso linear baseado na posição.
        </div>
      </CardContent>
    </Card>
  )
}
