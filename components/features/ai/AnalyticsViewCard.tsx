'use client'

import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

/**
 * Renders the structured `view` payload returned by an analytics tool.
 * Mapping: shape of the data drives which Recharts component shows up.
 *   - kpis       → row of metric cards with delta arrows
 *   - time_series → area chart (good for trends)
 *   - bar        → bar chart (rankings, comparisons)
 *   - pie        → pie chart (distributions)
 *   - table      → tabular data
 */

type AnalyticsView =
  | { type: 'kpis'; items: Array<{ label: string; value: string; delta?: number; deltaLabel?: string }> }
  | { type: 'time_series'; data: Array<Record<string, any>>; series: Array<{ key: string; label: string; color?: string }> }
  | { type: 'bar'; data: Array<{ name: string; value: number }>; color?: string }
  | { type: 'pie'; data: Array<{ name: string; value: number }> }
  | { type: 'table'; columns: string[]; rows: any[][] }
  | { type: 'none' }

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function AnalyticsViewCard({ view, label }: { view: AnalyticsView; label?: string }) {
  if (!view || view.type === 'none') return null

  return (
    <Card className="bg-card/60 border-muted">
      <CardContent className="p-4">
        {label && (
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
            {label}
          </div>
        )}
        {renderView(view)}
      </CardContent>
    </Card>
  )
}

function renderView(view: AnalyticsView): React.ReactNode {
  switch (view.type) {
    case 'kpis':
      return <KpisRow items={view.items} />
    case 'time_series':
      return <TimeSeriesChart data={view.data} series={view.series} />
    case 'bar':
      return <SimpleBar data={view.data} color={view.color} />
    case 'pie':
      return <SimplePie data={view.data} />
    case 'table':
      return <SimpleTable columns={view.columns} rows={view.rows} />
    default:
      return null
  }
}

type KpiItem = { label: string; value: string; delta?: number; deltaLabel?: string }

function KpisRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((it, i) => (
        <div key={i} className="p-3 rounded-lg bg-background border min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
            {it.label}
          </div>
          <div className="text-sm sm:text-lg font-bold tabular-nums mt-1 leading-tight break-words">{it.value}</div>
          {it.delta != null && (
            <div
              className={`text-[10px] mt-1 inline-flex items-center gap-0.5 ${
                it.delta >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {it.delta >= 0 ? (
                <ArrowUpRight className="w-2.5 h-2.5" />
              ) : (
                <ArrowDownRight className="w-2.5 h-2.5" />
              )}
              {Math.abs(it.delta).toFixed(1)}%{' '}
              <span className="text-muted-foreground">{it.deltaLabel || 'vs. anterior'}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TimeSeriesChart({
  data,
  series,
}: {
  data: Array<Record<string, any>>
  series: Array<{ key: string; label: string; color?: string }>
}) {
  const formatXTick = (s: string) => {
    // Accept YYYY-MM-DD or YYYY-MM
    if (/^\d{4}-\d{2}$/.test(s)) {
      const [y, m] = s.split('-')
      return `${m}/${y.slice(2)}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
    return s
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || '#3b82f6'} stopOpacity={0.3} />
              <stop offset="100%" stopColor={s.color || '#3b82f6'} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tickFormatter={formatXTick} fontSize={11} />
        <YAxis
          fontSize={11}
          tickFormatter={n => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n))}
        />
        <RTooltip
          formatter={(v: any, name: any) => {
            // Try to detect currency cents heuristically (large integers).
            const num = Number(v) || 0
            if (Number.isInteger(num) && num >= 100) {
              return [
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(num / 100),
                name,
              ]
            }
            return [num, name]
          }}
        />
        {series.length > 1 && <Legend />}
        {series.map(s => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color || '#3b82f6'}
            fill={`url(#grad-${s.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function SimpleBar({ data, color }: { data: Array<{ name: string; value: number }>; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" fontSize={11} />
        <YAxis type="category" dataKey="name" fontSize={11} width={120} />
        <RTooltip />
        <Bar dataKey="value" fill={color || '#3b82f6'} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function SimplePie({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <RTooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 flex-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="truncate">{d.name}</span>
            </div>
            <span className="tabular-nums text-muted-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(c => (
              <TableHead key={c} className="text-xs">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell: any, j: number) => (
                <TableCell key={j} className="text-xs tabular-nums">
                  {String(cell ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
