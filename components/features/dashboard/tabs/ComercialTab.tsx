import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDashboardMetrics, getRevenueForecast } from '@/actions/dashboard'
import { getMarketingOverview } from '@/actions/marketing'
import KpiCard from '../KpiCard'
import LeadSourcesWidget from '../LeadSourcesWidget'
import MetricChartWidget from '../MetricChartWidget'
import ConversionFunnelWidget from '../ConversionFunnelWidget'
import RevenueForecastWidget from '../RevenueForecastWidget'
import MockBarListCard from '../mocks/MockBarListCard'
import { MOCK_CAMPAIGN_ROAS } from '../mocks/mockData'
import { Target } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function ComercialTab({ ctx }: { ctx: WidgetCtx }) {
  const [metrics, marketing, forecast] = await Promise.all([
    getDashboardMetrics(ctx.orgId, ctx.period, ctx.pipelineId, ctx.sellerId),
    getMarketingOverview(ctx.orgSlug, '30d'),
    getRevenueForecast(ctx.orgId, { pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
  ])
  const conversionPct = metrics.newLeads.value > 0
    ? (metrics.conversions.value / metrics.newLeads.value) * 100
    : 0
  const cplCents = marketing.totals.leads > 0
    ? Math.round(marketing.totals.spend_cents / marketing.totals.leads)
    : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Leads no mês"
          value={String(metrics.newLeads.value)}
          help="Novos leads criados no período selecionado."
        />
        <KpiCard
          label="CPL (custo por lead)"
          value={fmtCurrency(cplCents)}
          help="Investimento em campanhas dividido pelo número de leads atribuídos a elas, últimos 30 dias."
        />
        <KpiCard
          label="Taxa de conversão"
          value={`${conversionPct.toFixed(1)}%`}
          help="Percentual de leads do período que chegaram a um estágio de fechamento."
        />
        <KpiCard
          label="Previsão de fechamento"
          value={fmtCurrency(forecast.combined_forecast_cents)}
          help="Valor já ganho no mês somado ao valor esperado do pipeline em aberto, ponderado pela probabilidade histórica de cada estágio."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <LeadSourcesWidget orgId={ctx.orgId} period={ctx.period} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
        <div className="md:col-span-4">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <MetricChartWidget
              orgId={ctx.orgId}
              period={ctx.period}
              metric="leads"
              pipelineId={ctx.pipelineId}
              sellerId={ctx.sellerId}
            />
          </Suspense>
        </div>
        <div className="md:col-span-4">
          <MockBarListCard
            title="Ranking de campanhas (ROAS)"
            help="Retorno sobre investimento por campanha Meta Ads — depende de vincular venda a campanha."
            icon={Target}
            rows={MOCK_CAMPAIGN_ROAS}
            color="#0f62fe"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
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
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <RevenueForecastWidget orgId={ctx.orgId} orgSlug={ctx.orgSlug} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="comercial" />
      </Suspense>
    </div>
  )
}
