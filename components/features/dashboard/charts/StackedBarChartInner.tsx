'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CARBON_CHART_AXIS } from '@/lib/charts/carbon-theme'
import { TOOLTIP_STYLE } from './chartFormat'

export type StackSeries = { key: string; name: string; color: string }

export interface StackedBarChartProps {
  data: Array<Record<string, string | number>>
  series: StackSeries[]
  /** Unidade exibida no tooltip (ex.: "oportunidades"). */
  unit?: string
}

/** Colunas empilhadas (contagem), uma por categoria do eixo X. */
export default function StackedBarChartInner({ data, series, unit = '' }: StackedBarChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} strokeDasharray="3 3" />
          <XAxis dataKey="label" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false} tick={{ fill: CARBON_CHART_AXIS.stroke }} dy={6} interval={0} />
          <YAxis fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false} tick={{ fill: CARBON_CHART_AXIS.stroke }} width={36} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const total = payload.reduce((a, p) => a + (Number(p.value) || 0), 0)
              return (
                <div style={TOOLTIP_STYLE}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label} — {total} {unit}</div>
                  {[...payload].reverse().map(p => (
                    <div key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                      {p.name}: {p.value}
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="stack"
              fill={s.color}
              stroke="hsl(var(--card))"
              strokeWidth={1}
              maxBarSize={56}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
