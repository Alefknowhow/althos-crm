'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type Point = {
  date: string
  spend_cents: number
  impressions: number
  clicks: number
  leads: number
}

type Props = { data: Point[] }

type MetricKey = 'spend' | 'impressions' | 'clicks' | 'leads' | 'cpl' | 'ctr'

// Each metric tracks: human label, color, axis to render on, and how to
// extract from a raw row (some are derived). Two Y-axes keep R$ values from
// being squashed by big counters like impressions.
const METRICS: Record<
  MetricKey,
  {
    label: string
    color: string
    axis: 'left' | 'right'
    type: 'area' | 'line'
    extract: (p: Point) => number
    format: (v: number) => string
  }
> = {
  spend: {
    label: 'Investimento',
    color: '#3b82f6',
    axis: 'left',
    type: 'area',
    extract: p => p.spend_cents / 100,
    format: v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),
  },
  impressions: {
    label: 'Impressões',
    color: '#a855f7',
    axis: 'right',
    type: 'line',
    extract: p => p.impressions,
    format: v => new Intl.NumberFormat('pt-BR').format(v),
  },
  clicks: {
    label: 'Cliques',
    color: '#ec4899',
    axis: 'right',
    type: 'line',
    extract: p => p.clicks,
    format: v => new Intl.NumberFormat('pt-BR').format(v),
  },
  leads: {
    label: 'Leads',
    color: '#10b981',
    axis: 'right',
    type: 'line',
    extract: p => p.leads,
    format: v => new Intl.NumberFormat('pt-BR').format(v),
  },
  cpl: {
    label: 'CPL',
    color: '#f59e0b',
    axis: 'left',
    type: 'line',
    extract: p => (p.leads > 0 ? p.spend_cents / 100 / p.leads : 0),
    format: v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),
  },
  ctr: {
    label: 'CTR (%)',
    color: '#06b6d4',
    axis: 'right',
    type: 'line',
    extract: p => (p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0),
    format: v => `${v.toFixed(2)}%`,
  },
}

const DEFAULT_VISIBLE: MetricKey[] = ['spend', 'leads']

export default function MetricsChart({ data }: Props) {
  const [visible, setVisible] = useState<Set<MetricKey>>(new Set(DEFAULT_VISIBLE))

  // Flatten extracted values onto each point so Recharts can pick them by key.
  const chartData = useMemo(() => {
    return data.map(p => {
      const out: Record<string, any> = { date: p.date }
      ;(Object.keys(METRICS) as MetricKey[]).forEach(k => {
        out[k] = METRICS[k].extract(p)
      })
      return out
    })
  }, [data])

  function toggle(k: MetricKey) {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(k)) {
        // Don't allow turning the last metric off — the chart would be empty.
        if (next.size <= 1) return prev
        next.delete(k)
      } else next.add(k)
      return next
    })
  }

  const visibleArray = (Object.keys(METRICS) as MetricKey[]).filter(k => visible.has(k))
  const needsLeftAxis = visibleArray.some(k => METRICS[k].axis === 'left')
  const needsRightAxis = visibleArray.some(k => METRICS[k].axis === 'right')

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
        Sem dados no período. Lance gastos manualmente ou importe um CSV.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(METRICS) as MetricKey[]).map(k => {
          const m = METRICS[k]
          const on = visible.has(k)
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all inline-flex items-center gap-1.5 ${
                on
                  ? 'border-transparent shadow-sm'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground'
              }`}
              style={
                on
                  ? { backgroundColor: `${m.color}1f`, color: m.color, borderColor: `${m.color}55` }
                  : undefined
              }
              title={on ? 'Ocultar' : 'Mostrar'}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: on ? m.color : 'transparent', border: on ? 'none' : `1px solid currentColor` }}
              />
              {m.label}
            </button>
          )
        })}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData}>
          <defs>
            {visibleArray
              .filter(k => METRICS[k].type === 'area')
              .map(k => (
                <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={METRICS[k].color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={METRICS[k].color} stopOpacity={0} />
                </linearGradient>
              ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            }
            fontSize={11}
          />
          {needsLeftAxis && (
            <YAxis
              yAxisId="left"
              orientation="left"
              fontSize={11}
              tickFormatter={n => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)}
            />
          )}
          {needsRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              fontSize={11}
              tickFormatter={n => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)}
            />
          )}
          <RTooltip
            labelFormatter={(d: any) =>
              new Date(d).toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })
            }
            formatter={(v: any, name: any) => {
              const k = name as MetricKey
              return [METRICS[k].format(Number(v) || 0), METRICS[k].label]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: any) => METRICS[value as MetricKey]?.label || value}
          />
          {visibleArray.map(k => {
            const m = METRICS[k]
            if (m.type === 'area') {
              return (
                <Area
                  key={k}
                  yAxisId={m.axis}
                  type="monotone"
                  dataKey={k}
                  name={k}
                  stroke={m.color}
                  fill={`url(#grad-${k})`}
                  strokeWidth={2}
                />
              )
            }
            return (
              <Line
                key={k}
                yAxisId={m.axis}
                type="monotone"
                dataKey={k}
                name={k}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
