'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'

export interface CashFlowProjectionChartProps {
  data: { day: string; saldo_previsto_cents: number }[]
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

export default function CashFlowProjectionChartInner({ data }: CashFlowProjectionChartProps) {
  const chartData = data.map(d => ({ ...d, label: fmtDay(d.day) }))
  const color = carbonColor(0)

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="cashFlowProjectionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} />
          <XAxis dataKey="label" fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} dy={6} minTickGap={32} />
          <YAxis fontSize={CARBON_CHART_AXIS.fontSize} tickLine={false} axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }} width={48} tickFormatter={fmtAxis} />
          <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeOpacity={0.5} strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))', borderRadius: '0px', border: '1px solid hsl(var(--border))',
              fontSize: '12px', padding: '10px 12px', color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            formatter={(v) => [fmtCurrency(Number(v) || 0), 'Saldo previsto'] as [string, string]}
          />
          <Area type="monotone" dataKey="saldo_previsto_cents" stroke={color} strokeWidth={2}
            fill="url(#cashFlowProjectionFill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
