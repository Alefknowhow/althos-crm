'use client'

import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtCurrency0, fmtDays, fmtPct } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'
import { COMPACT_CARD_H } from './dashboardSizes'

export type ComparisonSeller = {
  id: string
  name: string
  revenue_cents: number
  sales_count: number
  conversion_pct: number | null
  ticket_cents: number
  goal_pct: number | null
  avg_cycle_days: number | null
}

type MetricKey = 'revenue' | 'sales' | 'conversion' | 'ticket' | 'goal' | 'cycle'

const METRICS: Record<MetricKey, { label: string; get: (s: ComparisonSeller) => number | null; fmt: (v: number) => string; lowerIsBetter?: boolean }> = {
  revenue: { label: 'Receita', get: s => s.revenue_cents, fmt: fmtCurrency0 },
  sales: { label: 'Vendas', get: s => s.sales_count, fmt: v => String(v) },
  conversion: { label: 'Conversão', get: s => s.conversion_pct, fmt: v => fmtPct(v) },
  ticket: { label: 'Ticket', get: s => s.ticket_cents, fmt: fmtCurrency0 },
  goal: { label: 'Meta', get: s => s.goal_pct, fmt: v => fmtPct(v) },
  cycle: { label: 'Ciclo', get: s => s.avg_cycle_days, fmt: v => fmtDays(v), lowerIsBetter: true },
}

/**
 * Comparativo entre vendedores: um único gráfico de barras horizontais com
 * seletor de métrica. Todas as métricas chegam juntas do servidor — trocar
 * a métrica só reordena/redesenha no client, sem refetch.
 */
export default function SellerComparisonCard({ sellers, selectedId }: { sellers: ComparisonSeller[]; selectedId: string | null }) {
  const [metric, setMetric] = useState<MetricKey>('revenue')
  const m = METRICS[metric]
  const rows = useMemo(() => {
    const withVal = sellers.map(s => ({ s, v: m.get(s) })).filter((r): r is { s: ComparisonSeller; v: number } => r.v !== null)
    return withVal.sort((a, b) => (m.lowerIsBetter ? a.v - b.v : b.v - a.v))
  }, [sellers, m])
  const max = Math.max(1, ...rows.map(r => r.v))
  const avg = rows.length > 0 ? rows.reduce((a, r) => a + r.v, 0) / rows.length : 0

  return (
    <Card className={cn(COMPACT_CARD_H, 'flex flex-col overflow-hidden')}>
      <CardHeader className="pb-2 shrink-0 space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Comparativo entre vendedores
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Ordenado por {m.label.toLowerCase()}{m.lowerIsBetter ? ' (menor é melhor)' : ''}. Linha tracejada = média ({rows.length > 0 ? m.fmt(avg) : '—'}).
            </p>
          </div>
          <Select value={metric} onValueChange={v => setMetric(v as MetricKey)}>
            <SelectTrigger className="h-8 w-[140px] text-xs shrink-0" aria-label="Métrica do comparativo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(METRICS) as MetricKey[]).map(k => (
                <SelectItem key={k} value={k} className="text-xs">{METRICS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de {m.label.toLowerCase()} no período.</p>
        ) : (
          <div className="space-y-2 pr-1">
            {rows.map(({ s, v }) => (
              <div key={s.id} className="grid grid-cols-[120px_1fr_84px] items-center gap-3 text-xs group" title={`${s.name}: ${m.fmt(v)}`}>
                <span className={cn('truncate font-medium', selectedId === s.id && 'text-primary')}>{s.name}</span>
                <div className="relative h-5 rounded bg-muted/40">
                  <div
                    className={cn('h-full rounded transition-[width] duration-300 group-hover:brightness-110', selectedId && selectedId !== s.id ? 'bg-primary/40' : 'bg-primary')}
                    style={{ width: `${(v / max) * 100}%` }}
                  />
                  <div className="absolute top-[-2px] bottom-[-2px] border-l border-dashed border-foreground/60" style={{ left: `${(avg / max) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums font-semibold">{m.fmt(v)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
