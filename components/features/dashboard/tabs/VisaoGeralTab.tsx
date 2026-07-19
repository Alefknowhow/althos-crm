import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDashboardMetrics } from '@/actions/dashboard'
import { getTicketMedio } from '@/actions/dashboard-tabs'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import RevenueVsGoalWidget from '../RevenueVsGoalWidget'
import ConversionFunnelWidget from '../ConversionFunnelWidget'
import LeadSourcesWidget from '../LeadSourcesWidget'
import TopProductsWidget from '../TopProductsWidget'
import SellersRankingWidget from '../SellersRankingWidget'
import MockDonutCard from '../mocks/MockDonutCard'
import MockInsightCard from '../mocks/MockInsightCard'
import { MOCK_CUSTOMER_SEGMENTS } from '../mocks/mockData'
import InsightCard from '../InsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function VisaoGeralTab({ ctx }: { ctx: WidgetCtx }) {
  const [metrics, ticket] = await Promise.all([
    getDashboardMetrics(ctx.orgId, ctx.period, ctx.pipelineId, ctx.sellerId),
    getTicketMedio(ctx.orgId, sinceFromPeriod(ctx.period)),
  ])
  const conversionPct = metrics.newLeads.value > 0
    ? (metrics.conversions.value / metrics.newLeads.value) * 100
    : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <KpiCard
          label="Receita no mês"
          value={fmtCurrency(metrics.revenue.value * 100)}
          help="Soma das vendas concluídas no período selecionado."
        />
        <KpiCard
          label="Taxa de conversão"
          value={`${conversionPct.toFixed(1)}%`}
          help="Percentual de leads do período que chegaram a um estágio de fechamento."
        />
        <KpiCard
          label="Leads no mês"
          value={String(metrics.newLeads.value)}
          help="Novos leads criados no período selecionado."
        />
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticket.avg_cents)}
          help="Receita do período dividida pelo número de vendas concluídas."
        />
        <KpiCard
          label="Taxa de recompra"
          value="24%"
          help="Percentual de clientes que compraram mais de uma vez."
          mock
        />
        <KpiCard
          label="Tempo médio de resposta"
          value="12 min"
          help="Tempo médio entre a mensagem do lead e a primeira resposta da equipe."
          mock
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <RevenueVsGoalWidget
              orgId={ctx.orgId}
              orgSlug={ctx.orgSlug}
              period={ctx.period}
              pipelineId={ctx.pipelineId}
              sellerId={ctx.sellerId}
            />
          </Suspense>
        </div>
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <ConversionFunnelWidget
              orgSlug={ctx.orgSlug}
              pipelineId={ctx.pipelineId}
              initialResult={ctx.initialFunnel}
              sourceOptions={ctx.funnelSourceOptions}
            />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <LeadSourcesWidget orgId={ctx.orgId} period={ctx.period} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
        <div className="md:col-span-3">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <TopProductsWidget orgId={ctx.orgId} since={sinceFromPeriod(ctx.period)} />
          </Suspense>
        </div>
        <div className="md:col-span-3">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <SellersRankingWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} />
          </Suspense>
        </div>
        <div className="md:col-span-3">
          <MockDonutCard
            title="Segmentos de cliente"
            help="Distribuição da carteira de clientes por segmento de valor."
            segments={MOCK_CUSTOMER_SEGMENTS}
          />
        </div>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="visao-geral" />
      </Suspense>
    </div>
  )
}
