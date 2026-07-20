'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'

export interface CashFlowChartProps {
  data: { month: string; receitas_cents: number; despesas_cents: number }[]
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtAxis(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format((cents || 0) / 100)
}

export default function CashFlowChartInner({ data }: CashFlowChartProps) {
  const chartData = data.map(d => ({ ...d, label: fmtMonth(d.month) }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} />
          <XAxis dataKey="label" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} dy={6} />
          <YAxis fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} width={48} tickFormatter={fmtAxis} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))', borderRadius: '0px', border: '1px solid hsl(var(--border))',
              fontSize: '12px', padding: '10px 12px', color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            formatter={(v, name) => [fmtCurrency(Number(v) || 0), name === 'receitas_cents' ? 'Receita' : 'Despesa'] as [string, string]}
          />
          <Legend
            formatter={v => v === 'receitas_cents' ? 'Receita' : 'Despesa'}
            wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
          />
          <Bar dataKey="receitas_cents" fill={carbonColor(2)} radius={[2, 2, 0, 0]} />
          <Bar dataKey="despesas_cents" fill={carbonColor(7)} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
