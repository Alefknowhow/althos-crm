'use client'

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { RevenueCommissionPoint } from '@/actions/dashboard'

export interface RevenueVsGoalChartProps {
  points: RevenueCommissionPoint[]
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
  revenue_cents: 'Receita acumulada',
  commission_cents: 'Comissão acumulada',
}

export default function RevenueVsGoalChartInner({ points, hasCommission }: RevenueVsGoalChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
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
            tickFormatter={fmtAxis}
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
            formatter={(v, name) => [fmtCurrency(Number(v) || 0), LABELS[name as string] || (name as string)] as [string, string]}
          />
          <Legend
            formatter={(name) => LABELS[name as string] || name}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="revenue_cents"
            stroke="#0f62fe"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          {hasCommission && (
            <Line
              type="monotone"
              dataKey="commission_cents"
              stroke="#24a148"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
