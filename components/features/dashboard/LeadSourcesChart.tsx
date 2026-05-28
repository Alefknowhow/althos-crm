'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface LeadSourcesChartProps {
  data: { name: string; value: number }[]
}

const APPLE_PALETTE = [
  '#0071e3', // systemBlue
  '#34c759', // systemGreen
  '#ff9500', // systemOrange
  '#af52de', // systemPurple
  '#ff3b30', // systemRed
  '#30b0c7', // systemTeal
]

export default function LeadSourcesChart({ data }: LeadSourcesChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card className="reveal">
      <CardHeader className="pb-2">
        <CardTitle className="text-base tracking-apple-tighter">Origens dos leads</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full relative">
          {/* Center label inside donut */}
          {total > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-9">
              <span className="text-[28px] font-semibold tracking-apple-tighter leading-none tabular-nums">
                {total}
              </span>
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mt-1">
                Total
              </span>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="42%"
                innerRadius={70}
                outerRadius={92}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={APPLE_PALETTE[index % APPLE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 12px 32px -4px rgba(0,0,0,0.12), 0 4px 12px -2px rgba(0,0,0,0.06)',
                  fontSize: '12px',
                  padding: '8px 10px',
                  color: 'hsl(var(--foreground))',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
