'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface MetricChartProps {
  points: { date: string; value: number }[]
  color: string
  format: 'number' | 'currency'
  label: string
}

function fmtValue(v: number, format: 'number' | 'currency'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  }
  return new Intl.NumberFormat('pt-BR').format(v || 0)
}

function fmtAxis(v: number, format: 'number' | 'currency'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v || 0)
  }
  return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v || 0)
}

export default function MetricChartInner({ points, color, format, label }: MetricChartProps) {
  const gradientId = `metric-grad-${label.replace(/\s+/g, '')}`

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="date"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            dy={6}
            minTickGap={24}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={48}
            tickFormatter={(v: number) => fmtAxis(v, format)}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              borderRadius: '0px',
              border: '1px solid hsl(var(--border))',
              fontSize: '12px',
              padding: '10px 12px',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(v) => [fmtValue(Number(v) || 0, format), label] as [string, string]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.25}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
