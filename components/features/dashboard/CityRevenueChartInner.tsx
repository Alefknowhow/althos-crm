'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { CityRow } from '@/actions/dashboard-tabs'

export interface CityRevenueChartProps {
  rows: CityRow[]
  /** Comissão só existe no nicho viagens — quando não há, a barra vira uma
   *  cor só (receita total), sem o segmento de comissão. */
  hasCommission: boolean
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtAxis(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(
    (cents || 0) / 100,
  )
}

const LABELS: Record<string, string> = {
  commission_cents: 'Comissão',
  revenue_rest_cents: 'Receita (restante)',
  customers: 'Clientes',
}

export default function CityRevenueChartInner({ rows, hasCommission }: CityRevenueChartProps) {
  // Barra empilhada: comissão embaixo + o restante da receita em cima —
  // a extensão total da barra sempre representa a receita total da cidade.
  const data = rows.map(r => ({
    city: r.city,
    commission_cents: r.commission_cents,
    revenue_rest_cents: Math.max(0, r.revenue_cents - r.commission_cents),
    revenue_cents: r.revenue_cents,
    customers: r.customers,
  }))

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <XAxis
            xAxisId="revenue"
            type="number"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={fmtAxis}
          />
          <XAxis xAxisId="customers" type="number" hide />
          <YAxis
            type="category"
            dataKey="city"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={90}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              borderRadius: '0px',
              border: '1px solid hsl(var(--border))',
              fontSize: '12px',
              padding: '10px 12px',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            formatter={(v, name) => {
              if (name === 'customers') return [String(v), 'Clientes'] as [string, string]
              return [fmtCurrency(Number(v) || 0), LABELS[name as string] || (name as string)] as [string, string]
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            height={32}
            formatter={name => LABELS[name as string] || name}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          {hasCommission && (
            <Bar xAxisId="revenue" dataKey="commission_cents" stackId="revenue" fill="#24a148" />
          )}
          <Bar
            xAxisId="revenue"
            dataKey={hasCommission ? 'revenue_rest_cents' : 'revenue_cents'}
            stackId="revenue"
            fill="#0f62fe"
            radius={hasCommission ? [0, 4, 4, 0] : [4, 4, 4, 4]}
          />
          <Line
            xAxisId="customers"
            type="monotone"
            dataKey="customers"
            stroke="#8a3ffc"
            strokeWidth={2.25}
            dot={{ r: 3, strokeWidth: 0, fill: '#8a3ffc' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
