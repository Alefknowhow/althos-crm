import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDashboardMetrics } from '@/actions/dashboard'
import { getTicketMedio } from '@/actions/dashboard-tabs'
import { getMonthlyRevenueGoal } from '@/actions/organization'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import RevenueVsGoalWidget from '../RevenueVsGoalWidget'
import ConversionFunnelWidget from '../ConversionFunnelWidget'
import LeadSourcesWidget from '../LeadSourcesWidget'
import SellersRankingWidget from '../SellersRankingWidget'
import PipelineAtRiskWidget from '../PipelineAtRiskWidget'
import MockInsightCard from '../mocks/MockInsightCard'
import InsightCard from '../InsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/**
 * Visão Geral — dashboard executiva: "como está o negócio?". Só o essencial
 * pra responder isso em segundos; detalhamento de cada frente (pipeline,
 * vendas, clientes, equipe) mora nas outras abas.
 */
export default async function VisaoGeralTab({ ctx }: { ctx: WidgetCtx }) {
  const [metrics, ticket, monthlyGoalCents] = await Promise.all([
    getDashboardMetrics(ctx.orgId, ctx.period, ctx.pipelineId, ctx.sellerId),
    getTicketMedio(ctx.orgId, sinceFromPeriod(ctx.period)),
    getMonthlyRevenueGoal(ctx.orgSlug),
  ])
  const conversionPct = metrics.newLeads.value > 0
    ? (metrics.conversions.value / metrics.newLeads.value) * 100
    : 0
  const pipelineValueCents = ctx.initialFunnel.total_value_cents

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard
          label="Receita"
          value={fmtCurrency(metrics.revenue.value * 100)}
          help="Soma das vendas concluídas no período selecionado."
        />
        <KpiCard
          label="Vendas"
          value={String(ticket.sales_count)}
          help="Número de vendas concluídas no período selecionado."
        />
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticket.avg_cents)}
          help="Receita do período dividida pelo número de vendas concluídas."
        />
        <KpiCard
          label="Conversão"
          value={`${conversionPct.toFixed(1)}%`}
          help="Percentual de leads do período que chegaram a um estágio de fechamento."
        />
        <KpiCard
          label="Meta do mês"
          value={monthlyGoalCents ? fmtCurrency(monthlyGoalCents) : '—'}
          help="Meta de receita mensal configurada para a organização (Configurações › Metas)."
        />
        <KpiCard
          label="Pipeline aberto"
          value={fmtCurrency(pipelineValueCents)}
          help="Soma do valor de todas as oportunidades em aberto no funil, na filtragem atual."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-7">
          <Suspense fallback={<Skeleton className="h-[340px] w-full" />}>
            <RevenueVsGoalWidget
              orgId={ctx.orgId}
              orgSlug={ctx.orgSlug}
              period={ctx.period}
              pipelineId={ctx.pipelineId}
              sellerId={ctx.sellerId}
            />
          </Suspense>
        </div>
        <div className="md:col-span-5">
          <Suspense fallback={<Skeleton className="h-[340px] w-full" />}>
            <ConversionFunnelWidget
              orgSlug={ctx.orgSlug}
              pipelineId={ctx.pipelineId}
              initialResult={ctx.initialFunnel}
              sourceOptions={ctx.funnelSourceOptions}
            />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <LeadSourcesWidget orgId={ctx.orgId} period={ctx.period} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <SellersRankingWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
        <PipelineAtRiskWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} pipelineId={ctx.pipelineId} />
      </Suspense>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="visao-geral" />
      </Suspense>
    </div>
  )
}
