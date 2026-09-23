import { Suspense } from 'react'
import { DollarSign, ShoppingCart, Receipt, TrendingUp, Target, ShoppingBasket } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDashboardMetrics, getDates, getMonthlyGoalProgress } from '@/actions/dashboard'
import { getTicketMedio } from '@/actions/dashboard-tabs'
import { compareValues, comparePoints } from '@/lib/dashboard/compare'
import KpiCard from '../KpiCard'
import { MobileKpiGrid } from '@/components/features/mobile/MobileKpiGrid'
import RevenueVsGoalWidget from '../RevenueVsGoalWidget'
import ConversionFunnelWidget from '../ConversionFunnelWidget'
import StageThroughputWidget from '../StageThroughputWidget'
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
  const { start, previousStart, previousEnd } = getDates(ctx.period)

  const [metrics, ticket, prevTicket, monthlyGoal] = await Promise.all([
    getDashboardMetrics(ctx.orgId, ctx.period, ctx.pipelineId, ctx.sellerId),
    getTicketMedio(ctx.orgId, start),
    getTicketMedio(ctx.orgId, previousStart, previousEnd),
    getMonthlyGoalProgress(ctx.orgId),
  ])

  const conversionPct = metrics.newLeads.value > 0
    ? (metrics.conversions.value / metrics.newLeads.value) * 100
    : 0
  const previousConversionPct = metrics.newLeads.previousValue > 0
    ? (metrics.conversions.previousValue / metrics.newLeads.previousValue) * 100
    : null
  const pipelineValueCents = ctx.initialFunnel.total_value_cents

  const revenueCmp = compareValues(metrics.revenue.value, metrics.revenue.previousValue)
  const salesCmp = compareValues(ticket.sales_count, prevTicket.sales_count)
  const ticketCmp = compareValues(ticket.avg_cents, prevTicket.avg_cents)
  const conversionCmp = comparePoints(conversionPct, previousConversionPct)

  // Meta do mês: sempre o mês calendário corrente (não o período filtrado —
  // ver getMonthlyGoalProgress) e sempre da organização como um todo (uma
  // meta mensal não tem recorte por vendedor). Três estados possíveis: sem
  // meta configurada, meta configurada como zero (sem referência válida de
  // progresso) e meta > 0 (percentual real, sem limitar acima de 100% no
  // texto — só a barra visual é que nunca estoura o card).
  let metaValue: string
  let metaContext: string
  let metaProgressPct: number | undefined
  if (monthlyGoal.goalCents === null) {
    metaValue = '—'
    metaContext = 'Meta não configurada — defina em Configurações › Metas.'
  } else if (monthlyGoal.goalCents <= 0) {
    metaValue = fmtCurrency(monthlyGoal.realizedCents)
    metaContext = 'Meta configurada como R$ 0 — sem referência de progresso.'
  } else {
    const pct = Math.round((monthlyGoal.realizedCents / monthlyGoal.goalCents) * 100)
    metaValue = `${pct}%`
    metaProgressPct = pct
    metaContext = `${pct}% de ${fmtCurrency(monthlyGoal.goalCents)} · mês corrente`
  }

  return (
    <div className="space-y-5">
      {/* Mobile (spec M01): 4 KPIs prioritários em 2x2 (Receita/Conversão/
          Vendas/Pipeline aberto — os que respondem "como está o negócio"
          mais rápido), "Todos os indicadores" revela Ticket médio/Meta.
          Desktop mantém a grade de indicadores abaixo, agora responsiva por
          largura disponível em vez de 6 colunas fixas (issue #26). */}
      <div className="sm:hidden">
        <MobileKpiGrid
          items={[
            { label: 'Receita', value: fmtCurrency(metrics.revenue.value * 100), comparisonLabel: revenueCmp.trendLabel, trend: revenueCmp.trend },
            { label: 'Conversão', value: `${conversionPct.toFixed(1)}%`, comparisonLabel: conversionCmp.trendLabel, trend: conversionCmp.trend },
            { label: 'Vendas', value: String(ticket.sales_count), comparisonLabel: salesCmp.trendLabel, trend: salesCmp.trend },
            { label: 'Pipeline aberto', value: fmtCurrency(pipelineValueCents) },
            { label: 'Ticket médio', value: fmtCurrency(ticket.avg_cents), comparisonLabel: ticketCmp.trendLabel, trend: ticketCmp.trend },
            { label: 'Meta do mês', value: metaValue, comparisonLabel: metaContext, progressPct: metaProgressPct },
          ]}
        />
      </div>
      {/* `auto-fit`/`minmax` em vez de `grid-cols-6` fixo: a quantidade de
          cards por linha depende do espaço disponível, nunca força os 6 na
          mesma linha nem comprime o conteúdo pra caber (issue #26 §3). */}
      <div className="hidden sm:grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <KpiCard
          label="Receita"
          value={fmtCurrency(metrics.revenue.value * 100)}
          help="Soma das vendas concluídas no período selecionado."
          trend={revenueCmp.trend}
          trendLabel={revenueCmp.trendLabel}
          icon={<DollarSign />}
        />
        <KpiCard
          label="Vendas"
          value={String(ticket.sales_count)}
          help="Número de vendas concluídas no período selecionado."
          trend={salesCmp.trend}
          trendLabel={salesCmp.trendLabel}
          icon={<ShoppingCart />}
        />
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticket.avg_cents)}
          help="Receita do período dividida pelo número de vendas concluídas."
          trend={ticketCmp.trend}
          trendLabel={ticketCmp.trendLabel}
          icon={<Receipt />}
        />
        <KpiCard
          label="Conversão"
          value={`${conversionPct.toFixed(1)}%`}
          help="Percentual de leads do período que chegaram a um estágio de fechamento."
          trend={conversionCmp.trend}
          trendLabel={conversionCmp.trendLabel}
          icon={<TrendingUp />}
        />
        <KpiCard
          label="Meta do mês"
          value={metaValue}
          help="Meta de receita mensal da organização (Configurações › Metas) x receita realizada no mês corrente. Sempre o mês calendário atual, independente do período/vendedor selecionado nos filtros acima."
          trendLabel={metaContext}
          progressPct={metaProgressPct}
          icon={<Target />}
        />
        <KpiCard
          label="Pipeline aberto"
          value={fmtCurrency(pipelineValueCents)}
          help="Soma do valor de todas as oportunidades em aberto no funil, na filtragem atual. Foto do momento — não compara com período anterior."
          icon={<ShoppingBasket />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
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
          <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
            <PipelineAtRiskWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <LeadSourcesWidget orgId={ctx.orgId} period={ctx.period} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <SellersRankingWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
          <ConversionFunnelWidget
            orgSlug={ctx.orgSlug}
            pipelineId={ctx.pipelineId}
            initialResult={ctx.initialFunnel}
            sourceOptions={ctx.funnelSourceOptions}
          />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
          <StageThroughputWidget orgSlug={ctx.orgSlug} pipelineId={ctx.pipelineId} />
        </Suspense>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="visao-geral" />
      </Suspense>
    </div>
  )
}
