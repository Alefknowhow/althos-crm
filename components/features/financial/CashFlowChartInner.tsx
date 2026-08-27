'use client'

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'

export interface CashFlowChartProps {
  data: { month: string; receitas_cents: number; despesas_cents: number; saldo_cents: number }[]
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

const NAME_LABELS: Record<string, string> = {
  receitas_cents: 'Receita', despesas_cents: 'Despesa', saldo_cents: 'Saldo acumulado',
}

export default function CashFlowChartInner({ data }: CashFlowChartProps) {
  const chartData = data.map(d => ({ ...d, label: fmtMonth(d.month) }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
            formatter={(v, name) => [fmtCurrency(Number(v) || 0), NAME_LABELS[name as string] || name] as [string, string]}
          />
          <Legend
            formatter={v => NAME_LABELS[v as string] || v}
            wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
          />
          <Bar dataKey="receitas_cents" fill={carbonColor(2)} radius={[2, 2, 0, 0]} maxBarSize={28} />
          <Bar dataKey="despesas_cents" fill={carbonColor(7)} radius={[2, 2, 0, 0]} maxBarSize={28} />
          <Line type="monotone" dataKey="saldo_cents" stroke={carbonColor(0)} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
