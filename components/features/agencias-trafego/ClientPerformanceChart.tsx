'use client'

/**
 * Painel de indicadores/gráfico da aba Performance — mesmo espírito do
 * módulo Anúncios (KPIs + evolução diária de várias métricas), mas
 * escopado a este cliente. A aba Campanhas foi removida por duplicar isso
 * (tabela simples de campanhas); esta aba herdou o papel de "olhar os
 * números" completo, com o funil/gestão de contas ao lado.
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { ClientPerformanceSummary, ClientDailyPoint } from '@/actions/trafego-performance'
import MetricChart from '@/components/features/dashboard/MetricChart'

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null
  return ((curr - prev) / prev) * 100
}

function Kpi({ label, value, curr, prev, invertTrend }: { label: string; value: string; curr: number; prev: number; invertTrend?: boolean }) {
  const change = pctChange(curr, prev)
  const good = change == null ? null : invertTrend ? change <= 0 : change >= 0
  const Icon = (change ?? 0) >= 0 ? TrendingUp : TrendingDown
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tabular-nums">{value}</span>
        {change != null && (
          <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium', good ? 'text-emerald-600' : 'text-red-600')}>
            <Icon className="w-3 h-3" /> {Math.abs(change).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

type MetricKey = 'investmentCents' | 'leads' | 'salesRevenueCents' | 'impressions' | 'clicks' | 'ctr' | 'cplCents' | 'cpmCents'

const METRIC_OPTIONS: { key: MetricKey; label: string; color: string; format: 'number' | 'currency' | 'percent' }[] = [
  { key: 'investmentCents', label: 'Investimento', color: '#0f62fe', format: 'currency' },
  { key: 'leads', label: 'Leads', color: '#24a148', format: 'number' },
  { key: 'salesRevenueCents', label: 'Receita', color: '#8a3ffc', format: 'currency' },
  { key: 'impressions', label: 'Impressões', color: '#4589ff', format: 'number' },
  { key: 'clicks', label: 'Cliques', color: '#08bdba', format: 'number' },
  { key: 'ctr', label: 'CTR', color: '#d12771', format: 'percent' },
  { key: 'cplCents', label: 'CPL', color: '#ff832b', format: 'currency' },
  { key: 'cpmCents', label: 'CPM', color: '#a56eff', format: 'currency' },
]

/** Deriva CTR/CPL/CPM por dia a partir dos totais brutos — não são
 *  guardados na série, calcular na hora evita inconsistência de arredondar
 *  duas vezes (uma no banco, outra na UI). */
function derivedValue(p: ClientDailyPoint, key: MetricKey): number {
  switch (key) {
    case 'ctr': return p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0
    case 'cplCents': return p.leads > 0 ? p.investmentCents / p.leads : 0
    case 'cpmCents': return p.impressions > 0 ? (p.investmentCents / p.impressions) * 1000 : 0
    default: return p[key] as number
  }
}

export default function ClientPerformanceChart({
  current, previous, series,
}: {
  current: ClientPerformanceSummary
  previous: ClientPerformanceSummary
  series: ClientDailyPoint[]
}) {
  const [metric, setMetric] = useState<typeof METRIC_OPTIONS[number]>(METRIC_OPTIONS[0])

  // MetricChart espera valor em reais quando format='currency' (mesmo
  // contrato de getMetricTimeSeries/dashboard-timeseries.ts) — os valores
  // derivados aqui (investimento/CPL/CPM) vêm em centavos.
  const chartPoints = useMemo(
    () => series.map(p => {
      const raw = derivedValue(p, metric.key)
      return {
        date: new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        value: metric.format === 'currency' ? raw / 100 : raw,
      }
    }),
    [series, metric],
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Kpi label="Investimento" value={formatCurrency(current.investmentCents)} curr={current.investmentCents} prev={previous.investmentCents} invertTrend />
        <Kpi label="Impressões" value={current.impressions.toLocaleString('pt-BR')} curr={current.impressions} prev={previous.impressions} />
        <Kpi label="Cliques" value={current.clicks.toLocaleString('pt-BR')} curr={current.clicks} prev={previous.clicks} />
        <Kpi label="CTR" value={current.ctr != null ? `${(current.ctr * 100).toFixed(2)}%` : '—'} curr={current.ctr || 0} prev={previous.ctr || 0} />
        <Kpi label="Leads" value={String(current.leads)} curr={current.leads} prev={previous.leads} />
        <Kpi label="CPL" value={current.cplCents != null ? formatCurrency(current.cplCents) : '—'} curr={current.cplCents || 0} prev={previous.cplCents || 0} invertTrend />
        <Kpi label="CPM" value={current.cpmCents != null ? formatCurrency(current.cpmCents) : '—'} curr={current.cpmCents || 0} prev={previous.cpmCents || 0} invertTrend />
        <Kpi label="ROAS" value={current.roas != null ? `${current.roas.toFixed(1)}x` : '—'} curr={current.roas || 0} prev={previous.roas || 0} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm">Evolução (30 dias)</CardTitle>
          <div className="flex items-center gap-1 rounded-md border p-0.5 flex-wrap">
            {METRIC_OPTIONS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-sm font-medium transition-colors',
                  metric.key === m.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {chartPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados nesse período ainda.</p>
          ) : (
            <MetricChart
              points={chartPoints}
              color={metric.color}
              format={metric.format === 'percent' ? 'number' : metric.format}
              label={metric.label}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
