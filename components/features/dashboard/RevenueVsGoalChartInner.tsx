'use client'

import {
  AreaChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface RevenueVsGoalChartProps {
  points: { date: string; value: number }[]
  goalCents: number | null
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtAxis(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(
    (cents || 0) / 100,
  )
}

export default function RevenueVsGoalChartInner({ points, goalCents }: RevenueVsGoalChartProps) {
  // Points already come in reais (from getMetricTimeSeries) — convert to
  // cents so the goal line (stored in cents) shares the same axis.
  const data = points.map(p => ({ date: p.date, value_cents: Math.round(p.value * 100) }))

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-goal-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f62fe" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#0f62fe" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
            formatter={(v) => [fmtCurrency(Number(v) || 0), 'Receita'] as [string, string]}
          />
          <Area
            type="monotone"
            dataKey="value_cents"
            stroke="#0f62fe"
            strokeWidth={2.25}
            fill="url(#revenue-goal-grad)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          {goalCents != null && goalCents > 0 && (
            <ReferenceLine
              y={goalCents}
              stroke="#8a3ffc"
              strokeWidth={2}
              strokeDasharray="6 4"
              label={{ value: `Meta: ${fmtCurrency(goalCents)}`, position: 'insideTopRight', fontSize: 11, fill: '#8a3ffc' }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
