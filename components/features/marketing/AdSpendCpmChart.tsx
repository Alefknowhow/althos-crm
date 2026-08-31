'use client'

import { useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { getAdConversionRows, type AdConversionRow, type DrillDownError, type MarketingPeriod } from '@/actions/marketing'
import AdSegmentedBarChart, { type SegmentMetric } from './AdSegmentedBarChart'

const DRILL_DOWN_ERROR_LABEL: Record<DrillDownError, string> = {
  token_expired: 'Token da conta expirou — reconecte em Campanhas → Contas.',
  not_found: 'Não encontrado na Meta (pode ter sido excluído).',
  rate_limited: 'Muitas chamadas à Meta agora — tente novamente em instantes.',
  unknown: 'Falha ao buscar dados da Meta.',
}

const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const currencyShort = (v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '')}k` : Math.round(v)}`

function conversions(r: AdConversionRow): number {
  return r.meta_messaging_started + r.meta_leads + r.meta_purchases
}

const METRICS: [SegmentMetric, SegmentMetric, SegmentMetric] = [
  {
    key: 'investido', label: 'Valor investido', color: '#f97316',
    extract: (r: AdConversionRow) => r.spend_cents / 100,
    format: currency, formatShort: currencyShort,
  },
  {
    // CPM = custo por mil impressões, em reais: (spend_cents/impressions) * 1000 / 100.
    key: 'cpm', label: 'CPM', color: '#ec4899',
    extract: (r: AdConversionRow) => (r.impressions > 0 ? (r.spend_cents / r.impressions) * 10 : 0),
    format: currency, formatShort: currencyShort,
  },
  {
    key: 'valorPorConversao', label: 'Valor por conversão', color: '#6366f1',
    extract: (r: AdConversionRow) => (conversions(r) > 0 ? r.spend_cents / conversions(r) / 100 : 0),
    format: currency, formatShort: currencyShort,
  },
]

/**
 * Mesmo padrão visual de ConversionByAdChart (barra única por anúncio, 3
 * estágios normalizados) — aqui pro custo: valor investido, CPM e valor por
 * conversão. Fica no lugar de "Leads por campanha" (removido — esse dado
 * de custo por anúncio individual é mais acionável pra quem gerencia a
 * verba do que a distribuição de leads por campanha).
 */
export default function AdSpendCpmChart({
  orgSlug, adAccountId, period,
}: {
  orgSlug: string
  adAccountId: string | null
  period: MarketingPeriod | string
}) {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {METRICS.map(m => (
          <span key={m.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: m.color }} />
            {m.label}
          </span>
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
      ) : (
        <AdSegmentedBarChart
          rows={rows || []}
          metrics={METRICS}
          nameOf={(r: AdConversionRow) => r.name}
          campaignOf={(r: AdConversionRow) => r.campaign_name}
          emptyLabel="Nenhum dado de investimento no período."
        />
      )}
    </div>
  )
}
