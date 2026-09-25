import { Suspense } from 'react'
import { PlusCircle, Wallet, Scale, Percent, Clock, Gauge, Filter, Layers, Timer, Grid3x3, Megaphone, Target, XCircle, Hourglass } from 'lucide-react'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDates, getAverageTimePerStage } from '@/actions/dashboard'
import { getOpenPipeline, getPipelineKpis, getStepFunnel, getLeadOrigins, getLossReasons, buildAging, AGING_BUCKETS } from '@/actions/dashboard-v2-pipeline'
import { compareValues, comparePoints } from '@/lib/dashboard/compare'
import { fmtCurrency0, fmtCurrencyCompact, fmtDays, fmtPct } from '@/lib/dashboard/format'
import KpiRow from '../KpiRow'
import DashboardCard, { EmptyChart } from '../DashboardCard'
import BarListCard from '../BarListCard'
import HorizontalFunnel from '../charts/HorizontalFunnel'
import ConversionHeatmap from '../charts/ConversionHeatmap'
import StackedBarChart from '../charts/StackedBarChart'
import { MAIN_CARD_H, TABLE_CARD_H, COMPACT_CARD_H } from '../dashboardSizes'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

/** Sequencial de um tom (verde→vermelho seria "status"; aqui é magnitude de tempo parado). */
const AGING_COLORS: Record<string, string> = {
  '0-3d': '#a6c8ff',
  '4-7d': '#78a9ff',
  '8-14d': '#4589ff',
  '15-30d': '#0f62fe',
  '30+d': '#002d9c',
}

/**
 * Pipeline — eficiência comercial: "o que está em andamento, onde trava e
 * de onde vem?". Casa de Leads, Conversão e Origem de leads. Ticket médio e
 * receita realizada moram em Vendas.
 */
export default async function PipelineTab({ ctx }: { ctx: WidgetCtx }) {
  const range = getDates(ctx.period)
  const [kpis, open, funnel, timeInStage, origins, losses] = await Promise.all([
    getPipelineKpis(ctx.orgId, { ...range, pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getOpenPipeline(ctx.orgId, { pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getStepFunnel(ctx.orgId, { since: range.start, pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getAverageTimePerStage(ctx.orgId, { pipelineId: ctx.pipelineId }),
    getLeadOrigins(ctx.orgId, { since: range.start, pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getLossReasons(ctx.orgId, { since: range.start, pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
  ])

  const newCmp = compareValues(kpis.new_opportunities, kpis.previous_new_opportunities)
  const convCmp = comparePoints(kpis.conversion_pct, kpis.previous_conversion_pct)
  // Velocidade do pipeline = oportunidades abertas × valor médio ganho × taxa de conversão ÷ ciclo médio.
  const velocity = kpis.avg_cycle_days && kpis.avg_cycle_days > 0
    ? (open.deals.length * kpis.avg_won_value_cents * (kpis.conversion_pct / 100)) / kpis.avg_cycle_days
    : null

  const stageAvg = timeInStage.length > 0 ? timeInStage.reduce((a, s) => a + s.avg_days, 0) / timeInStage.length : 0
  const aging = buildAging(open)
  const originsWithConv = origins.filter(o => o.leads >= 1).sort((a, b) => b.conversion_pct - a.conversion_pct)

  return (
    <div className="space-y-5">
      <KpiRow
        items={[
          { label: 'Novas oportunidades', value: String(kpis.new_opportunities), help: 'Oportunidades (leads) criadas no período.', trend: newCmp.trend, trendLabel: newCmp.trendLabel, icon: <PlusCircle /> },
          { label: 'Pipeline aberto', value: fmtCurrencyCompact(open.total_value_cents), help: 'Valor total das oportunidades abertas agora. Foto do momento.', trendLabel: `${open.deals.length} oportunidade(s)`, icon: <Wallet /> },
          { label: 'Pipeline ponderado', value: fmtCurrencyCompact(open.weighted_value_cents), help: 'Valor aberto × probabilidade de fechamento do estágio (histórico de 90 dias; sem histórico, peso pela posição).', trendLabel: open.total_value_cents > 0 ? `${fmtPct((open.weighted_value_cents / open.total_value_cents) * 100)} do aberto` : undefined, icon: <Scale /> },
          { label: 'Conversão', value: fmtPct(kpis.conversion_pct, 1), help: 'Oportunidades ganhas no período ÷ oportunidades criadas no período.', trend: convCmp.trend, trendLabel: convCmp.trendLabel, icon: <Percent /> },
          { label: 'Ciclo médio', value: fmtDays(kpis.avg_cycle_days), help: 'Dias médios entre a criação e o fechamento (ganho) das oportunidades fechadas no período.', trendLabel: `${kpis.won_in_period} fechada(s)`, icon: <Clock /> },
          { label: 'Velocidade', value: velocity !== null ? `${fmtCurrencyCompact(velocity)}/dia` : '—', help: 'Oportunidades abertas × valor médio ganho × conversão ÷ ciclo médio — receita potencial que o pipeline movimenta por dia no ritmo atual.', icon: <Gauge /> },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-8">
          <DashboardCard
            title="Funil de conversão"
            help={`Oportunidades criadas no período: quantas chegaram a cada estágio, valor, conversão para o próximo e taxa acumulada até a venda. Geral: ${fmtPct(funnel.overall_pct, 1)}.`}
            icon={Filter}
            heightClass={TABLE_CARD_H}
            scroll
          >
            {funnel.total === 0 ? (
              <EmptyChart text="Nenhuma oportunidade criada no período." />
            ) : (
              <HorizontalFunnel detailed steps={funnel.stages.map(s => ({ name: s.name, count: s.reached, value_cents: s.value_cents, conv_next_pct: s.conv_next_pct, to_won_pct: s.to_won_pct, color: s.color }))} />
            )}
          </DashboardCard>
        </div>
        <div className="md:col-span-4">
          <BarListCard
            title="Pipeline por estágio"
            help="Valor financeiro aberto em cada estágio, agora."
            icon={Layers}
            color="#0f62fe"
            heightClass={TABLE_CARD_H}
            rows={open.stages.map(s => ({ label: s.name, value: s.value_cents, valueLabel: fmtCurrencyCompact(s.value_cents), sublabel: `${s.count} opp.` }))}
            emptyText="Nenhuma oportunidade aberta."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <BarListCard
            title="Tempo médio por estágio"
            help="Dias médios de permanência em cada estágio (últimos 90 dias). Destaque = acima da média entre estágios."
            icon={Timer}
            color="#8d8d8d"
            heightClass={MAIN_CARD_H}
            referenceValue={stageAvg}
            referenceLabel={`Média entre estágios: ${fmtDays(stageAvg)}`}
            rows={timeInStage.map(s => ({
              label: s.stage_name,
              value: s.avg_days,
              valueLabel: fmtDays(s.avg_days),
              color: s.avg_days > stageAvg ? '#fa4d56' : '#8d8d8d',
              highlight: s.avg_days > stageAvg ? 'acima da média' : undefined,
            }))}
            emptyText="Sem movimentação de estágio nos últimos 90 dias."
          />
        </div>
        <div className="md:col-span-6">
          <DashboardCard title="Conversão entre estágios" help="% das oportunidades de cada estágio (linha) que chegaram ao estágio da coluna." icon={Grid3x3} heightClass={MAIN_CARD_H}>
            {funnel.total === 0 || funnel.stages.length < 2 ? (
              <EmptyChart text="Sem oportunidades suficientes no período." />
            ) : (
              <ConversionHeatmap stages={funnel.stages.map(s => ({ name: s.name, reached: s.reached }))} />
            )}
          </DashboardCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4">
          <BarListCard
            title="Origem dos leads"
            help="Quantidade de leads criados no período, por origem."
            icon={Megaphone}
            color="#0f62fe"
            rows={origins.map(o => ({ label: o.source, value: o.leads, valueLabel: String(o.leads) }))}
            emptyText="Nenhum lead no período."
          />
        </div>
        <div className="md:col-span-4">
          <BarListCard
            title="Performance por origem"
            help="Conversão (ganhos ÷ leads) dos leads do período, por origem."
            icon={Target}
            color="#24a148"
            maxValue={100}
            rows={originsWithConv.map(o => ({ label: o.source, value: o.conversion_pct, valueLabel: fmtPct(o.conversion_pct), sublabel: `${o.won}/${o.leads}` }))}
            emptyText="Nenhum lead no período."
          />
        </div>
        <div className="md:col-span-4">
          <BarListCard
            title="Motivos de perda"
            help="% das oportunidades perdidas/desqualificadas no período, por motivo informado."
            icon={XCircle}
            color="#da1e28"
            maxValue={100}
            rows={losses.map(l => ({ label: l.reason, value: l.pct, valueLabel: fmtPct(l.pct), sublabel: `${l.count}` }))}
            emptyText="Nenhuma perda registrada no período."
          />
        </div>
      </div>

      <DashboardCard
        title="Aging do pipeline"
        help={`Oportunidades abertas por estágio e há quanto tempo estão sem interação. ${open.deals.filter(d => d.idle_days > 14).length} parada(s) há mais de 14 dias · ${fmtCurrency0(open.deals.filter(d => d.idle_days > 14).reduce((a, d) => a + d.value_cents, 0))} em jogo.`}
        icon={Hourglass}
        heightClass={COMPACT_CARD_H}
      >
        {open.deals.length === 0 ? (
          <EmptyChart text="Nenhuma oportunidade aberta." />
        ) : (
          <StackedBarChart
            unit="oportunidades"
            data={aging.map(a => ({ label: a.stage, ...Object.fromEntries(AGING_BUCKETS.map(b => [b, a[b]])) }))}
            series={AGING_BUCKETS.map(b => ({ key: b, name: b.replace('d', ' dias'), color: AGING_COLORS[b] }))}
          />
        )}
      </DashboardCard>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="pipeline" />
      </Suspense>
    </div>
  )
}
