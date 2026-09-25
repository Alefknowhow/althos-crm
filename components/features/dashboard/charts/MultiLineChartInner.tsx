'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CARBON_CHART_AXIS } from '@/lib/charts/carbon-theme'
import { formatAxis, formatValue, TOOLTIP_STYLE, type ValueFormat } from './chartFormat'

export type LineSeries = { key: string; name: string; color: string }

export interface MultiLineChartProps {
  data: Array<Record<string, string | number | null>>
  series: LineSeries[]
  format?: ValueFormat
}

export default function MultiLineChartInner({ data, series, format = 'number' }: MultiLineChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} strokeDasharray="3 3" />
          <XAxis dataKey="label" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false} tick={{ fill: CARBON_CHART_AXIS.stroke }} dy={6} interval="preserveStartEnd" minTickGap={8} />
          <YAxis fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false} tick={{ fill: CARBON_CHART_AXIS.stroke }} width={40} allowDecimals={format !== 'number'} tickFormatter={v => formatAxis(v, format)} />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div style={TOOLTIP_STYLE}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  {payload.map(p => (
                    <div key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color }} />
                      {p.name}: {formatValue(p.value as number, format)}
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {series.length > 1 && <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
          {series.map(s => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3, fill: s.color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
