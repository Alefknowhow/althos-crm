'use client'

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'

export type MockScatterPoint = { frequency: number; ticket: number; name: string }

export default function MockScatterChartInner({ points }: { points: MockScatterPoint[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <XAxis
            type="number"
            dataKey="frequency"
            name="Frequência"
            unit="x"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            type="number"
            dataKey="ticket"
            name="Ticket médio"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={48}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              borderRadius: '0px',
              border: '1px solid hsl(var(--border))',
              fontSize: '12px',
              padding: '10px 12px',
              color: 'hsl(var(--foreground))',
            }}
            formatter={(v: any, n: any) => [v, n]}
            labelFormatter={() => ''}
          />
          <Scatter data={points} fill="#8a3ffc" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
