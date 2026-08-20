import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getTicketMedio } from '@/actions/dashboard-tabs'
import { getMonthlyRevenueGoal } from '@/actions/organization'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import RevenueVsGoalWidget from '../RevenueVsGoalWidget'
import RevenueForecastWidget from '../RevenueForecastWidget'
import TopProductsWidget from '../TopProductsWidget'
import MockBarListCard from '../mocks/MockBarListCard'
import { MOCK_CAMPAIGN_ROAS } from '../mocks/mockData'
import { Target } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/** Vendas — "o que efetivamente vendemos?". Resultado realizado, não previsão. */
export default async function VendasTab({ ctx }: { ctx: WidgetCtx }) {
  const [ticket, monthlyGoalCents] = await Promise.all([
    getTicketMedio(ctx.orgId, sinceFromPeriod(ctx.period)),
    getMonthlyRevenueGoal(ctx.orgSlug),
  ])
  const goalProgressPct = monthlyGoalCents && monthlyGoalCents > 0
    ? Math.round((ticket.revenue_cents / monthlyGoalCents) * 100)
    : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Receita"
          value={fmtCurrency(ticket.revenue_cents)}
          help="Soma das vendas concluídas no período selecionado."
        />
        <KpiCard
          label="Meta do mês"
          value={monthlyGoalCents ? fmtCurrency(monthlyGoalCents) : '—'}
          trendLabel={goalProgressPct !== null ? `${goalProgressPct}% atingido` : undefined}
          help="Meta de receita mensal configurada para a organização (Configurações › Metas)."
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
            <RevenueForecastWidget orgId={ctx.orgId} orgSlug={ctx.orgSlug} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <TopProductsWidget orgId={ctx.orgId} since={sinceFromPeriod(ctx.period)} />
          </Suspense>
        </div>
        <div className="md:col-span-6">
          <MockBarListCard
            title="Ranking de campanhas (ROAS)"
            help="Retorno sobre investimento por campanha Meta Ads — depende de vincular venda a campanha."
            icon={Target}
            rows={MOCK_CAMPAIGN_ROAS}
            color="#0f62fe"
          />
        </div>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="vendas" />
      </Suspense>
    </div>
  )
}
