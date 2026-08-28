'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell } from 'recharts'
import { cn } from '@/lib/utils'

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f97316', '#ec4899', '#22c55e']

type CampaignLite = {
  name: string
  leads: number
  meta_messaging_started: number
  meta_purchases: number
  meta_purchase_value_cents: number
}

type MetricOpt = 'conversas' | 'leads' | 'compras' | 'valor'

const METRIC_LABELS: Record<MetricOpt, string> = {
  conversas: 'Conversas',
  leads: 'Leads',
  compras: 'Compras',
  valor: 'Valor gerado',
}

const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const number = (v: number) => new Intl.NumberFormat('pt-BR').format(v)

function valueOf(c: CampaignLite, metric: MetricOpt): number {
  if (metric === 'conversas') return c.meta_messaging_started
  if (metric === 'leads') return c.leads
  if (metric === 'compras') return c.meta_purchases
  return c.meta_purchase_value_cents / 100
}

/**
 * Ranking em barras dos anúncios/campanhas por métrica de conversão — cada
 * campanha pode ter um objetivo diferente (Mensagens, Leads, Vendas), então
 * em vez de fixar "conversas iniciadas" como métrica única, deixa escolher
 * qual dado olhar (badges acima do gráfico).
 */
export default function ConversionByAdChart({ campaigns }: { campaigns: CampaignLite[] }) {
  const [metric, setMetric] = useState<MetricOpt>('conversas')

  const data = campaigns
    .map(c => ({ name: c.name, value: valueOf(c, metric) }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(METRIC_LABELS) as MetricOpt[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              metric === m ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/40',
            )}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
          Nenhum dado de {METRIC_LABELS[metric].toLowerCase()} no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
            <XAxis type="number" fontSize={11} tickFormatter={v => (metric === 'valor' ? currency(v) : number(v))} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              fontSize={11}
              tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)}
            />
            <RTooltip formatter={(v: any) => [metric === 'valor' ? currency(Number(v) || 0) : number(Number(v) || 0), METRIC_LABELS[metric]]} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
