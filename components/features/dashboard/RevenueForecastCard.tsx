'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Trophy, Loader2 } from 'lucide-react'
import { fetchRevenueForecast } from '@/actions/dashboard-forecast'
import type { RevenueForecast } from '@/actions/dashboard'
import { CHART_CARD_H } from './dashboardSizes'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

type Seller = { id: string; name: string }

/**
 * Revenue forecast: sum of (current pipeline value × probability of close).
 * Probability is learned from the last 90 days when there's enough data,
 * falls back to position-based weights otherwise. Filtro de vendedor é
 * próprio do card — independente do filtro global da página.
 */
export default function RevenueForecastCard({
  orgSlug,
  pipelineId,
  initialForecast,
  sellers,
}: {
  orgSlug: string
  pipelineId: string | null
  initialForecast: RevenueForecast
  sellers: Seller[]
}) {
  const [sellerId, setSellerId] = useState<string>('all')
  const [forecast, setForecast] = useState(initialForecast)
  const [isPending, startTransition] = useTransition()

  function handleSellerChange(value: string) {
    setSellerId(value)
    startTransition(async () => {
      const next = await fetchRevenueForecast(orgSlug, {
        pipelineId,
        sellerId: value === 'all' ? null : value,
      })
      setForecast(next)
    })
  }

  return (
    <Card className={`${CHART_CARD_H} flex flex-col overflow-hidden`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 shrink-0 pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Forecast de receita
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Já ganho + projeção do pipeline ponderada por probabilidade.
          </p>
        </div>
        {sellers.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs max-w-[140px]"
              value={sellerId}
              onChange={e => handleSellerChange(e.target.value)}
            >
              <option value="all">Todos vendedores</option>
              {sellers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-3">
        {/* Big number */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200 dark:border-emerald-800 shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-medium">
            Projeção combinada (mês)
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-emerald-900 dark:text-emerald-100">
            {fmtCurrency(forecast.combined_forecast_cents)}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-emerald-800 dark:text-emerald-200">
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

        {/* Per-stage breakdown — rola dentro do espaço restante, nunca
            empurra o card a crescer conforme o número de estágios. */}
        {forecast.stages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sem dados no pipeline pra projetar.
          </p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 sticky top-0 bg-card">
              Por estágio
            </div>
            <div className="space-y-2">
              {/* Bars are scaled to the expected (weighted) value so they
                  visually track the R$ numbers — an empty stage shows no bar,
                  the biggest contributor fills the track. */}
              {(() => {
                const maxExpected = Math.max(
                  1,
                  ...forecast.stages.map(s => s.expected_value_cents || 0),
                )
                return forecast.stages.map(row => {
                  const barPct = ((row.expected_value_cents || 0) / maxExpected) * 100
                  return (
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
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {row.lead_count} lead{row.lead_count !== 1 ? 's' : ''} no estágio
                  </div>
                </div>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
