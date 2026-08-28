'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type Point = { date: string; impressions: number; spend_cents: number }

const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const number = (v: number) => new Intl.NumberFormat('pt-BR').format(v)

export default function ImpressionsCpmChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
        Sem dados no período.
      </div>
    )
  }

  const chartData = data.map(p => ({
    date: p.date,
    impressions: p.impressions,
    cpm: p.impressions > 0 ? (p.spend_cents / 100 / p.impressions) * 1000 : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          fontSize={11}
        />
        <YAxis yAxisId="left" orientation="left" fontSize={11} tickFormatter={n => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)} />
        <YAxis yAxisId="right" orientation="right" fontSize={11} tickFormatter={n => currency(n)} />
        <RTooltip
          labelFormatter={(d: any) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          formatter={(v: any, name: any) =>
            name === 'cpm' ? [currency(Number(v) || 0), 'CPM'] : [number(Number(v) || 0), 'Impressões']
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => (v === 'cpm' ? 'CPM' : 'Impressões')} />
        <Bar yAxisId="left" dataKey="impressions" name="impressions" fill="#a855f7" radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cpm" name="cpm" stroke="#eab308" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
