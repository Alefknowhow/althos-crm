'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'

export interface DailyCashFlowChartProps {
  data: { day: string; receitas_cents: number; despesas_cents: number; saldo_cents: number }[]
}

function fmtDay(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
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

export default function DailyCashFlowChartInner({ data }: DailyCashFlowChartProps) {
  const chartData = data.map(d => ({ ...d, label: fmtDay(d.day) }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} />
          <XAxis dataKey="label" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} dy={6} minTickGap={24} />
          <YAxis fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} width={48} tickFormatter={fmtAxis} />
          <Tooltip
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
          <Line type="monotone" dataKey="receitas_cents" stroke={carbonColor(2)} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="despesas_cents" stroke={carbonColor(7)} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="saldo_cents" stroke={carbonColor(0)} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
