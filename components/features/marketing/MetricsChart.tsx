'use client'

import { useMemo } from 'react'
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
import { METRIC_REGISTRY, type MetricKey, type MetricContext } from './metricRegistry'

type Point = MetricContext & { date: string }

type Props = { data: Point[]; visible: Set<MetricKey> }

export default function MetricsChart({ data, visible }: Props) {
  // Flatten extracted values onto each point so Recharts can pick them by key.
  const chartData = useMemo(() => {
    return data.map(p => {
      const out: Record<string, any> = { date: p.date }
      ;(Object.keys(METRIC_REGISTRY) as MetricKey[]).forEach(k => {
        out[k] = METRIC_REGISTRY[k].extract(p)
      })
      return out
    })
  }, [data])

  const visibleArray = (Object.keys(METRIC_REGISTRY) as MetricKey[]).filter(k => visible.has(k) && METRIC_REGISTRY[k].chartable)
  const needsLeftAxis = visibleArray.some(k => METRIC_REGISTRY[k].axis === 'left')
  const needsRightAxis = visibleArray.some(k => METRIC_REGISTRY[k].axis === 'right')

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
        Sem dados no período. Lance gastos manualmente ou importe um CSV.
      </div>
    )
  }

  if (visibleArray.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
        Nenhuma métrica selecionada pro gráfico — use &quot;Personalizar&quot; pra escolher.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData}>
          <defs>
            {visibleArray
              .filter(k => METRIC_REGISTRY[k].type === 'area')
              .map(k => (
                <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={METRIC_REGISTRY[k].color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={METRIC_REGISTRY[k].color} stopOpacity={0} />
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
              return [METRIC_REGISTRY[k].format(Number(v) || 0), METRIC_REGISTRY[k].label]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: any) => METRIC_REGISTRY[value as MetricKey]?.label || value}
          />
          {visibleArray.map(k => {
            const m = METRIC_REGISTRY[k]
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
