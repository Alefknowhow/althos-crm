'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell } from 'recharts'
import { Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAdConversionRows, type AdConversionRow, type DrillDownError, type MarketingPeriod } from '@/actions/marketing'

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f97316', '#ec4899', '#22c55e']

type MetricOpt = 'conversas' | 'leads' | 'compras' | 'valor'

const METRIC_LABELS: Record<MetricOpt, string> = {
  conversas: 'Conversas',
  leads: 'Leads',
  compras: 'Compras',
  valor: 'Valor gerado',
}

const DRILL_DOWN_ERROR_LABEL: Record<DrillDownError, string> = {
  token_expired: 'Token da conta expirou — reconecte em Campanhas → Contas.',
  not_found: 'Não encontrado na Meta (pode ter sido excluído).',
  rate_limited: 'Muitas chamadas à Meta agora — tente novamente em instantes.',
  unknown: 'Falha ao buscar dados da Meta.',
}

const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const number = (v: number) => new Intl.NumberFormat('pt-BR').format(v)

function valueOf(c: AdConversionRow, metric: MetricOpt): number {
  if (metric === 'conversas') return c.meta_messaging_started
  if (metric === 'leads') return c.meta_leads
  if (metric === 'compras') return c.meta_purchases
  return c.meta_purchase_value_cents / 100
}

/**
 * Ranking em barras dos ANÚNCIOS individuais (não campanhas) por métrica de
 * conversão — cada anúncio pode estar numa campanha com objetivo diferente
 * (Mensagens, Leads, Vendas), então deixa escolher qual dado olhar. Dados
 * vêm direto da Meta (level=ad, uma chamada por conta), buscados no cliente
 * — não entra no carregamento inicial do painel pra não pesar a página toda
 * vez, só quando este card está visível.
 */
export default function ConversionByAdChart({
  orgSlug, adAccountId, period,
}: {
  orgSlug: string
  adAccountId: string | null
  period: MarketingPeriod | string
}) {
  const [metric, setMetric] = useState<MetricOpt>('conversas')
  const [rows, setRows] = useState<AdConversionRow[] | null>(null)
  const [error, setError] = useState<DrillDownError | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    const res = await getAdConversionRows(orgSlug, adAccountId, period as MarketingPeriod)
    setLoading(false)
    if (res.ok) setRows(res.rows)
    else { setRows(null); setError(res.error) }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, adAccountId, period])

  const data = (rows || [])
    .map(c => ({ name: c.name, campaign: c.campaign_name, value: valueOf(c, metric) }))
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

      {loading ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Buscando anúncios na Meta…
        </div>
      ) : error ? (
        <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-sm text-destructive text-center px-4">
          <span>{DRILL_DOWN_ERROR_LABEL[error]}</span>
          <button type="button" onClick={load} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline text-xs">
            <RotateCcw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      ) : data.length === 0 ? (
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
            <RTooltip
              formatter={(v: any) => [metric === 'valor' ? currency(Number(v) || 0) : number(Number(v) || 0), METRIC_LABELS[metric]]}
              labelFormatter={(name: any, payload: any) => payload?.[0]?.payload?.campaign ? `${name} · ${payload[0].payload.campaign}` : name}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
