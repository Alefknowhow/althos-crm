'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, TrendingDown, Sparkles, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  getClientPerformanceComparison, getClientDailySeries,
  type ClientPerformanceSummary, type ClientDailyPoint,
} from '@/actions/trafego-performance'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'
import { computeClientHealthStatus, HEALTH_LABEL, HEALTH_BADGE_CLASS } from '@/lib/trafego/health-status'
import { computeClientAlerts } from '@/lib/trafego/alerts'
import MetricChart from '@/components/features/dashboard/MetricChart'

type Period = 'hoje' | '7d' | '30d'

function rangeFor(period: Period): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date()
  if (period === 'hoje') from.setHours(0, 0, 0, 0)
  else if (period === '7d') from.setDate(from.getDate() - 6)
  else from.setDate(from.getDate() - 29)
  return { from, to }
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null
  return ((curr - prev) / prev) * 100
}

function Trend({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const change = pctChange(curr, prev)
  if (change === null) return null
  const good = invert ? change <= 0 : change >= 0
  const Icon = change >= 0 ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium', good ? 'text-emerald-600' : 'text-red-600')}>
      <Icon className="w-3 h-3" /> {Math.abs(change).toFixed(0)}%
    </span>
  )
}

function Kpi({ label, value, curr, prev, invertTrend }: { label: string; value: string; curr: number; prev: number; invertTrend?: boolean }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tabular-nums">{value}</span>
        <Trend curr={curr} prev={prev} invert={invertTrend} />
      </div>
    </div>
  )
}

const METRIC_OPTIONS: { key: 'investmentCents' | 'leads' | 'salesRevenueCents'; label: string; color: string; format: 'number' | 'currency' }[] = [
  { key: 'investmentCents', label: 'Investimento', color: '#0f62fe', format: 'currency' },
  { key: 'leads', label: 'Leads', color: '#24a148', format: 'number' },
  { key: 'salesRevenueCents', label: 'Receita', color: '#8a3ffc', format: 'currency' },
]

export default function ClientOverviewTab({
  orgSlug, clientId, clientName, profile, lastSyncLabel, lastSyncDaysAgo,
  initialCurrent, initialPrevious, initialSeries,
}: {
  orgSlug: string
  clientId: string
  clientName: string
  profile: TrafficClientProfile | null
  lastSyncLabel: string | null
  lastSyncDaysAgo: number | null
  initialCurrent: ClientPerformanceSummary
  initialPrevious: ClientPerformanceSummary
  initialSeries: ClientDailyPoint[]
}) {
  const [period, setPeriod] = useState<Period>('30d')
  const [current, setCurrent] = useState(initialCurrent)
  const [previous, setPrevious] = useState(initialPrevious)
  const [series, setSeries] = useState(initialSeries)
  const [metric, setMetric] = useState<typeof METRIC_OPTIONS[number]>(METRIC_OPTIONS[0])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (period === '30d') { setCurrent(initialCurrent); setPrevious(initialPrevious); setSeries(initialSeries); return }
    const range = rangeFor(period)
    startTransition(async () => {
      const [{ current: c, previous: p }, s] = await Promise.all([
        getClientPerformanceComparison(orgSlug, clientId, range),
        getClientDailySeries(orgSlug, clientId, range),
      ])
      setCurrent(c); setPrevious(p); setSeries(s)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const health = computeClientHealthStatus({
    investmentCents: current.investmentCents,
    cplCents: current.cplCents,
    targetCpl: profile?.targetCpl ?? null,
    roas: current.roas,
    targetRoas: profile?.targetRoas ?? null,
  })

  const chartPoints = useMemo(
    () => series.map(p => ({ date: new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: p[metric.key] })),
    [series, metric],
  )

  const analysis = useMemo(() => buildAnalysis(current, previous, profile), [current, previous, profile])
  const recommendations = useMemo(() => computeClientAlerts(current, previous, profile, lastSyncDaysAgo), [current, previous, profile, lastSyncDaysAgo])

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{clientName}</h3>
              <Badge variant="outline" className={HEALTH_BADGE_CLASS[health]}>{HEALTH_LABEL[health]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastSyncLabel ? `Última sincronização: ${lastSyncLabel}` : 'Nenhuma sincronização registrada ainda'}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            {(['hoje', '7d', '30d'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-sm font-medium transition-colors',
                  period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                {p === 'hoje' ? 'Hoje' : p === '7d' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPIs priorizados */}
      <div className="relative">
        {isPending && (
          <div className="absolute inset-0 z-10 bg-background/50 grid place-items-center rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Investimento" value={formatCurrency(current.investmentCents)} curr={current.investmentCents} prev={previous.investmentCents} invertTrend />
          <Kpi label="Leads" value={String(current.leads)} curr={current.leads} prev={previous.leads} />
          <Kpi label="CPL" value={current.cplCents != null ? formatCurrency(current.cplCents) : '—'} curr={current.cplCents || 0} prev={previous.cplCents || 0} invertTrend />
          <Kpi label="Conversões" value={String(current.salesCount)} curr={current.salesCount} prev={previous.salesCount} />
          <Kpi label="CPA" value={current.cpaCents != null ? formatCurrency(current.cpaCents) : '—'} curr={current.cpaCents || 0} prev={previous.cpaCents || 0} invertTrend />
          <Kpi label="Receita" value={formatCurrency(current.revenueCents)} curr={current.revenueCents} prev={previous.revenueCents} />
          <Kpi label="ROAS" value={current.roas != null ? `${current.roas.toFixed(1)}x` : '—'} curr={current.roas || 0} prev={previous.roas || 0} />
        </div>
      </div>

      {/* Secundárias */}
      <details className="group">
        <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
          <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" /> Ver mais indicadores
        </summary>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Kpi label="Impressões" value={current.impressions.toLocaleString('pt-BR')} curr={current.impressions} prev={previous.impressions} />
          <Kpi label="Cliques" value={current.clicks.toLocaleString('pt-BR')} curr={current.clicks} prev={previous.clicks} />
          <Kpi label="CTR" value={current.ctr != null ? `${(current.ctr * 100).toFixed(2)}%` : '—'} curr={current.ctr || 0} prev={previous.ctr || 0} />
          <Kpi label="CPC" value={current.cpcCents != null ? formatCurrency(current.cpcCents) : '—'} curr={current.cpcCents || 0} prev={previous.cpcCents || 0} invertTrend />
          <Kpi label="CPM" value={current.cpmCents != null ? formatCurrency(current.cpmCents) : '—'} curr={current.cpmCents || 0} prev={previous.cpmCents || 0} invertTrend />
        </div>
      </details>

      {/* Gráfico */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Performance</CardTitle>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
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
            <MetricChart points={chartPoints} color={metric.color} format={metric.format} label={metric.label} />
          )}
        </CardContent>
      </Card>

      {/* Análise automática */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Análise automática</CardTitle></CardHeader>
        <CardContent>
          {analysis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há dados suficientes pra gerar uma análise.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {analysis.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recomendações */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recomendações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((r, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', r.severity === 'critico' ? 'bg-red-500' : 'bg-amber-500')} />
                  <span className="font-medium text-sm">{r.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled title="Diagnóstico detalhado — em breve">Analisar</Button>
                  <Button size="sm" variant="outline" disabled title="Execução automática ainda não disponível">Aplicar</Button>
                  <Button size="sm" variant="ghost">Ignorar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function buildAnalysis(curr: ClientPerformanceSummary, prev: ClientPerformanceSummary, profile: TrafficClientProfile | null): string[] {
  const lines: string[] = []
  if (curr.investmentCents === 0) return lines

  const investChange = pctChange(curr.investmentCents, prev.investmentCents)
  const cplChange = curr.cplCents != null && prev.cplCents != null ? pctChange(curr.cplCents, prev.cplCents) : null
  const leadsChange = pctChange(curr.leads, prev.leads)

  if (leadsChange !== null && Math.abs(leadsChange) >= 10) {
    lines.push(`Os leads ${leadsChange >= 0 ? 'subiram' : 'caíram'} ${Math.abs(leadsChange).toFixed(0)}% em relação ao período anterior.`)
  }
  if (cplChange !== null && Math.abs(cplChange) >= 10 && curr.cplCents != null && prev.cplCents != null) {
    lines.push(`O CPL ${cplChange <= 0 ? 'caiu' : 'subiu'} de ${formatCurrency(prev.cplCents)} para ${formatCurrency(curr.cplCents)}.`)
  }
  if (investChange !== null && Math.abs(investChange) >= 15) {
    lines.push(`O investimento ${investChange >= 0 ? 'aumentou' : 'reduziu'} ${Math.abs(investChange).toFixed(0)}% no período.`)
  }
  if (profile?.targetCpl && curr.cplCents != null) {
    const ratio = (curr.cplCents / 100) / profile.targetCpl
    if (ratio > 1) lines.push(`O CPL atual está ${((ratio - 1) * 100).toFixed(0)}% acima da meta configurada (${formatCurrency(profile.targetCpl * 100)}).`)
  }
  if (lines.length === 0) lines.push('Performance estável em relação ao período anterior, sem variações relevantes.')
  return lines
}
