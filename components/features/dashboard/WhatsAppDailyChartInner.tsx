'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CARBON_CHART_AXIS, carbonColor } from '@/lib/charts/carbon-theme'
import type { WhatsappDailyPoint } from '@/actions/whatsapp-analytics'

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const inbound = payload.find((p: any) => p.dataKey === 'inbound')?.value ?? 0
  const outbound = payload.find((p: any) => p.dataKey === 'outbound')?.value ?? 0
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
      <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid hsl(var(--border))', fontWeight: 600 }}>
        Total: {inbound + outbound}
      </div>
    </div>
  )
}

/**
 * Coluna empilhada (recebidas + enviadas = total de mensagens do dia) +
 * linha sobreposta com quantas dessas enviadas foram respondidas pelo
 * Agente IA (sent_by_name='IA' em whatsapp_messages).
 */
export default function WhatsAppDailyChartInner({ data }: { data: WhatsappDailyPoint[] }) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
          <Bar dataKey="inbound" name="Recebidas" stackId="msgs" fill={carbonColor(2)} fillOpacity={0.9} />
          <Bar dataKey="outbound" name="Enviadas" stackId="msgs" fill={carbonColor(0)} radius={[4, 4, 0, 0]} fillOpacity={0.9} />
          <Line
            type="monotone"
            dataKey="aiAnswered"
            name="Respondidas por IA"
            stroke={carbonColor(4)}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
