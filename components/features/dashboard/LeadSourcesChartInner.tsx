'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { CARBON_CHART_PALETTE } from '@/lib/charts/carbon-theme'

export interface LeadSourcesChartProps {
  data: { name: string; value: number }[]
}

export default function LeadSourcesChartInner({ data }: LeadSourcesChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
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
              <Cell key={`cell-${index}`} fill={CARBON_CHART_PALETTE[index % CARBON_CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              borderRadius: '0px',
              border: '1px solid hsl(var(--border))',
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
  )
}
