'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f97316', '#ec4899', '#22c55e']

export default function TopConversationsChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
        Nenhuma conversa iniciada no período — campanhas com objetivo de Mensagens aparecem aqui.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
        <XAxis type="number" fontSize={11} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          fontSize={11}
          tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)}
        />
        <RTooltip formatter={(v: any) => [new Intl.NumberFormat('pt-BR').format(Number(v) || 0), 'Conversas iniciadas']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
