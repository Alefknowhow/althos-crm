'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export interface LeadsTimeSeriesChartProps {
  data: any[]
}

// Apple-system inspired palette (resolves visually in both light and dark)
const APPLE_PALETTE = [
  '#0071e3', // systemBlue
  '#34c759', // systemGreen
  '#ff9500', // systemOrange
  '#af52de', // systemPurple
  '#ff3b30', // systemRed
  '#30b0c7', // systemTeal
  '#5856d6', // systemIndigo
  '#ff2d55', // systemPink
  '#ffcc00', // systemYellow
]

export default function LeadsTimeSeriesChartInner({ data }: LeadsTimeSeriesChartProps) {
  const stageNames = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'date') : []

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="date"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            dy={6}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              borderRadius: '12px',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 12px 32px -4px rgba(0,0,0,0.12), 0 4px 12px -2px rgba(0,0,0,0.06)',
              fontSize: '12px',
              padding: '10px 12px',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px', paddingTop: '14px', color: 'hsl(var(--muted-foreground))' }}
          />
          {stageNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={APPLE_PALETTE[i % APPLE_PALETTE.length]}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
