'use client'

import dynamic from 'next/dynamic'
import { TrendingUp, TrendingDown, Minus, FileText, Globe, Megaphone, Radio } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FormInsights } from '@/actions/form_submissions'

// Recharts uses browser APIs — must be loaded client-side only
const ResponsiveContainer = dynamic(
  () => import('recharts').then(m => m.ResponsiveContainer),
  { ssr: false },
)
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDay(iso: string) {
  // "2024-05-15" → "15/05"
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function Trend({ last30, prev30 }: { last30: number; prev30: number }) {
  if (prev30 === 0) return null
  const pct = Math.round(((last30 - prev30) / prev30) * 100)
  if (pct > 0)
    return (
      <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
        <TrendingUp className="w-3.5 h-3.5" />+{pct}% vs mês anterior
      </span>
    )
  if (pct < 0)
    return (
      <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
        <TrendingDown className="w-3.5 h-3.5" />
        {pct}% vs mês anterior
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-xs">
      <Minus className="w-3.5 h-3.5" />
      Igual ao mês anterior
    </span>
  )
}

function HBarList({
  items,
  labelKey,
  valueKey,
  color,
}: {
  items: Record<string, any>[]
  labelKey: string
  valueKey: string
  color: string
}) {
  const max = Math.max(...items.map(i => i[valueKey]), 1)
  return (
    <ul className="space-y-2.5">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-28 truncate shrink-0" title={item[labelKey]}>
            {item[labelKey]}
          </span>
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${(item[valueKey] / max) * 100}%`, background: color }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums w-6 text-right">{item[valueKey]}</span>
        </li>
      ))}
      {items.length === 0 && (
        <li className="text-xs text-muted-foreground py-2">Sem dados suficientes.</li>
      )}
    </ul>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function FormInsightsView({ data }: { data: FormInsights }) {
  const { totalSubmissions, last30, prev30, byDay, topSources, topCampaigns, topMediums } = data

  return (
    <div className="p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total de respostas</p>
            <p className="text-3xl font-bold tabular-nums">{totalSubmissions.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Últimos 30 dias</p>
            <p className="text-3xl font-bold tabular-nums">{last30.toLocaleString('pt-BR')}</p>
            <Trend last30={last30} prev30={prev30} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Período anterior</p>
            <p className="text-3xl font-bold tabular-nums text-muted-foreground">
              {prev30.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Volume chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Respostas por dia (últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <Tooltip
                  formatter={(v: any) => [v, 'Respostas']}
                  labelFormatter={(l: any) => formatDay(l)}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* UTM breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              Origem (utm_source)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList
              items={topSources}
              labelKey="source"
              valueKey="count"
              color="hsl(262, 80%, 65%)"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-muted-foreground" />
              Campanha (utm_campaign)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList
              items={topCampaigns}
              labelKey="campaign"
              valueKey="count"
              color="hsl(199, 89%, 48%)"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="w-4 h-4 text-muted-foreground" />
              Mídia (utm_medium)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList
              items={topMediums}
              labelKey="medium"
              valueKey="count"
              color="hsl(142, 71%, 45%)"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
