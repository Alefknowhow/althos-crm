'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'

export type SellerBarPoint = { seller_id: string | null; name: string; revenue_cents: number; sales_count: number }

export interface SellerBarChartProps {
  data: SellerBarPoint[]
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtAxis(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format((cents || 0) / 100)
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as SellerBarPoint | undefined
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name} — {p.sales_count} venda{p.sales_count === 1 ? '' : 's'}</div>
      <div>Faturamento: {fmtCurrency(p.revenue_cents)}</div>
    </div>
  )
}

export default function SellerBarChartInner({ data }: SellerBarChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            fontSize={CARBON_CHART_AXIS.fontSize}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }}
            dy={6}
            interval={0}
          />
          <YAxis
            fontSize={CARBON_CHART_AXIS.fontSize}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }}
            width={48}
            tickFormatter={fmtAxis}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} content={<CustomTooltip />} />
          <Bar dataKey="revenue_cents" name="Faturamento" radius={[4, 4, 0, 0]} fillOpacity={0.9}>
            {data.map((d, i) => <Cell key={d.seller_id || i} fill={carbonColor(i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
