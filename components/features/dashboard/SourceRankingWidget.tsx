import { Compass } from 'lucide-react'
import { getSourcePerformance } from '@/actions/dashboard'
import RankTable from './RankTable'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/**
 * Ranking de origem — mesma base de dados de Performance por Origem
 * (Pipeline), só que ordenado por receita gerada (já vem assim de
 * getSourcePerformance) em vez de taxa de conversão, pra responder "qual
 * origem trouxe mais resultado" na aba Vendas.
 */
export default async function SourceRankingWidget({
  orgId, pipelineId,
}: {
  orgId: string
  pipelineId: string | null
}) {
  const rows = await getSourcePerformance(orgId, { pipelineId, windowDays: 90 })

  return (
    <RankTable
      title="Ranking de origem"
      help="Últimos 90 dias, ordenado por receita gerada (leads ganhos)."
      icon={Compass}
      color="#0f62fe"
      emptyText="Sem vendas com origem identificada nos últimos 90 dias."
      rows={rows.map(r => ({
        label: r.source,
        subLabel: `${r.won}/${r.leads} ganhos · ${r.conversion_pct.toFixed(1)}%`,
        value: r.total_value_cents,
        valueLabel: fmtCurrency(r.total_value_cents),
      }))}
    />
  )
}
