'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'

export interface ExpensesByCategoryChartProps {
  data: { categoria: string; valor_cents: number }[]
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtAxis(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format((cents || 0) / 100)
}

export default function ExpensesByCategoryChartInner({ data }: ExpensesByCategoryChartProps) {
  const top = data.slice(0, 8)

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} />
          <XAxis type="number" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} tickFormatter={fmtAxis} />
          <YAxis type="category" dataKey="categoria" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} width={110} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))', borderRadius: '0px', border: '1px solid hsl(var(--border))',
              fontSize: '12px', padding: '10px 12px', color: 'hsl(var(--foreground))',
            }}
            formatter={v => [fmtCurrency(Number(v) || 0), 'Despesa'] as [string, string]}
          />
          <Bar dataKey="valor_cents" radius={[0, 2, 2, 0]}>
            {top.map((_, i) => <Cell key={i} fill={carbonColor(i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
