'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CARBON_CHART_AXIS } from '@/lib/charts/carbon-theme'
import { formatAxis, formatValue, TOOLTIP_STYLE, type ValueFormat } from './chartFormat'

export type BarLinePoint = {
  label: string
  bar: number
  line: number | null
  /** Linhas extras no tooltip (já formatadas no servidor). */
  extra?: string[]
}

export interface BarLineChartProps {
  data: BarLinePoint[]
  barName: string
  lineName: string
  barFormat?: ValueFormat
  lineFormat?: ValueFormat
  /** Eixo separado para a linha — só quando as grandezas são de escalas
   *  muito diferentes (ex.: faturamento x comissão); meta usa o mesmo eixo. */
  dualAxis?: boolean
  lineDashed?: boolean
  barColor?: string
  lineColor?: string
}

export default function BarLineChartInner({
  data, barName, lineName, barFormat = 'currency', lineFormat = 'currency', dualAxis = false,
  lineDashed = false, barColor = 'hsl(var(--primary))', lineColor = '#8a3ffc',
}: BarLineChartProps) {
  const hasLine = data.some(d => d.line !== null && d.line !== undefined)
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: dualAxis ? 4 : 12, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} strokeDasharray="3 3" />
          <XAxis dataKey="label" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false} tick={{ fill: CARBON_CHART_AXIS.stroke }} dy={6} interval="preserveStartEnd" minTickGap={8} />
          <YAxis yAxisId="left" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false} tick={{ fill: CARBON_CHART_AXIS.stroke }} width={44} tickFormatter={v => formatAxis(v, barFormat)} />
          {dualAxis && (
            <YAxis yAxisId="right" orientation="right" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false} tick={{ fill: CARBON_CHART_AXIS.stroke }} width={44} tickFormatter={v => formatAxis(v, lineFormat)} />
          )}
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0]?.payload as BarLinePoint
              return (
                <div style={TOOLTIP_STYLE}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div>{barName}: {formatValue(p.bar, barFormat)}</div>
                  {p.line !== null && p.line !== undefined && <div>{lineName}: {formatValue(p.line, lineFormat)}</div>}
                  {p.extra?.map(e => <div key={e} style={{ color: 'hsl(var(--muted-foreground))' }}>{e}</div>)}
                </div>
              )
            }}
          />
          <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="bar" name={barName} fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={36} />
          {hasLine && (
            <Line
              yAxisId={dualAxis ? 'right' : 'left'}
              type={lineDashed ? 'stepAfter' : 'monotone'}
              dataKey="line"
              name={lineName}
              stroke={lineColor}
              strokeWidth={2}
              strokeDasharray={lineDashed ? '6 4' : undefined}
              dot={lineDashed ? false : { r: 3, fill: lineColor, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
