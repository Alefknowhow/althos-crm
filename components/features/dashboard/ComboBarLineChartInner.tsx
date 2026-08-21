'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CARBON_CHART_AXIS } from '@/lib/charts/carbon-theme'

export type ComboBarLinePoint = {
  label: string
  revenue_cents: number
  commission_cents: number | null
  sales_count: number
}

export interface ComboBarLineChartProps {
  data: ComboBarLinePoint[]
  hasCommission: boolean
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtAxis(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format((cents || 0) / 100)
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as ComboBarLinePoint | undefined
  if (!p) return null
  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--popover))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '0px',
        padding: '10px 12px',
        fontSize: '12px',
        color: 'hsl(var(--foreground))',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label} — {p.sales_count} venda{p.sales_count === 1 ? '' : 's'}</div>
      <div>Faturamento: {fmtCurrency(p.revenue_cents)}</div>
      {p.commission_cents != null && <div>Comissão: {fmtCurrency(p.commission_cents)}</div>}
    </div>
  )
}

export default function ComboBarLineChartInner({ data, hasCommission }: ComboBarLineChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: hasCommission ? 16 : 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            fontSize={CARBON_CHART_AXIS.fontSize}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }}
            dy={6}
          />
          <YAxis
            yAxisId="left"
            fontSize={CARBON_CHART_AXIS.fontSize}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }}
            width={48}
            tickFormatter={fmtAxis}
          />
          {hasCommission && (
            <YAxis
              yAxisId="right"
              orientation="right"
              fontSize={CARBON_CHART_AXIS.fontSize}
              tickLine={false}
              axisLine={false}
              tick={{ fill: CARBON_CHART_AXIS.stroke }}
              width={48}
              tickFormatter={fmtAxis}
            />
          )}
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} content={<CustomTooltip />} />
          <Bar yAxisId="left" dataKey="revenue_cents" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} fillOpacity={0.9} />
          {hasCommission && (
            <Line yAxisId="right" type="monotone" dataKey="commission_cents" name="Comissão" stroke="#8a3ffc" strokeWidth={2.25} dot={{ r: 3, fill: '#8a3ffc', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
