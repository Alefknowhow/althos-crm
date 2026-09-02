'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'
import type { WhatsappDailyPoint } from '@/actions/whatsapp-analytics'

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{fmtDate(label)}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

export default function WhatsAppDailyChartInner({ data }: { data: WhatsappDailyPoint[] }) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CARBON_CHART_AXIS.gridStroke} strokeOpacity={0.6} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            fontSize={CARBON_CHART_AXIS.fontSize}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }}
            dy={6}
          />
          <YAxis
            fontSize={CARBON_CHART_AXIS.fontSize}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CARBON_CHART_AXIS.stroke }}
            width={36}
            allowDecimals={false}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="outbound" name="Enviadas" fill={carbonColor(0)} radius={[4, 4, 0, 0]} fillOpacity={0.9} />
          <Bar dataKey="inbound" name="Recebidas" fill={carbonColor(2)} radius={[4, 4, 0, 0]} fillOpacity={0.9} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
