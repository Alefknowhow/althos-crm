import { Suspense } from 'react'
import { DollarSign, ShoppingCart, Receipt, TrendingUp, Target, Gauge, BarChart3, Flag, Filter, AlertTriangle, Megaphone, Trophy } from 'lucide-react'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDates } from '@/actions/dashboard'
import { getSalesTotals, getMonthlyRevenueSeries, getMonthGoalProgress, getRevenueBySource } from '@/actions/dashboard-v2-sales'
import { getOpenPipeline, getPipelineKpis, getStepFunnel } from '@/actions/dashboard-v2-pipeline'
import { getTeamPerformance } from '@/actions/dashboard-v2-team'
import { listOrgMembers } from '@/actions/sales'
import { compareValues, comparePoints } from '@/lib/dashboard/compare'
import { fmtCurrency0, fmtCurrencyCompact, fmtPct } from '@/lib/dashboard/format'
import KpiRow from '../KpiRow'
import DashboardCard, { EmptyChart } from '../DashboardCard'
import BarListCard from '../BarListCard'
import BarLineChart from '../charts/BarLineChart'
import BulletForecast from '../charts/BulletForecast'
import HorizontalFunnel from '../charts/HorizontalFunnel'
import PipelineRiskList from '../lists/PipelineRiskList'
import TopSellersList from '../lists/TopSellersList'
import { MAIN_CARD_H, TABLE_CARD_H, COMPACT_CARD_H } from '../dashboardSizes'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

/**
 * Visão Geral — "como está o negócio?". Resumo executivo: cada indicador
 * aqui é a versão resumida de algo que mora em outra aba (Receita → Vendas,
 * Conversão/Funil → Pipeline, Top vendedores → Equipe). O que é exclusivo
 * daqui é a Meta consolidada do mês.
 */
export default async function VisaoGeralTab({ ctx }: { ctx: WidgetCtx }) {
  const range = getDates(ctx.period)
  const members = (await listOrgMembers(ctx.orgSlug)).map((m: any) => ({ id: m.id as string, name: m.name as string }))

  const [sales, series, monthGoal, pipeKpis, open, funnel, bySource, team] = await Promise.all([
    getSalesTotals(ctx.orgId, range, ctx.sellerId),
    getMonthlyRevenueSeries(ctx.orgId, { months: 12, sellerId: ctx.sellerId }),
    getMonthGoalProgress(ctx.orgId),
    getPipelineKpis(ctx.orgId, { ...range, pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getOpenPipeline(ctx.orgId, { pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getStepFunnel(ctx.orgId, { since: range.start, pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getRevenueBySource(ctx.orgId, range.start, ctx.sellerId),
    getTeamPerformance(ctx.orgId, members, { since: range.start }),
  ])

  const cur = sales.current
  const prev = sales.previous
  const revenueCmp = compareValues(cur.revenue_cents, prev?.revenue_cents)
  const salesCmp = compareValues(cur.sales_count, prev?.sales_count)
  const ticketCmp = compareValues(cur.ticket_cents, prev?.ticket_cents)
  const convCmp = comparePoints(pipeKpis.conversion_pct, pipeKpis.previous_conversion_pct)

  // Meta consolidada do mês (sempre o mês calendário corrente, org inteira).
  const goal = monthGoal.goalCents
  const goalPct = goal && goal > 0 ? (monthGoal.realizedCents / goal) * 100 : null
  const remaining = goal ? Math.max(0, goal - monthGoal.realizedCents) : null

  const nameById = Object.fromEntries(members.map(m => [m.id, m.name]))
  const riskOrder = { alto: 0, medio: 1, baixo: 2 } as const
  const atRisk = open.deals
    .filter(d => d.idle_days >= 3)
    .sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk] || b.value_cents - a.value_cents)
    .slice(0, 15)

  return (
    <div className="space-y-5">
      <KpiRow
        items={[
          { label: 'Receita', value: fmtCurrency0(cur.revenue_cents), help: 'Receita realizada (vendas concluídas) no período selecionado.', trend: revenueCmp.trend, trendLabel: revenueCmp.trendLabel, icon: <DollarSign /> },
          { label: 'Vendas', value: String(cur.sales_count), help: 'Quantidade de vendas concluídas no período.', trend: salesCmp.trend, trendLabel: salesCmp.trendLabel, icon: <ShoppingCart /> },
          { label: 'Ticket médio', value: fmtCurrency0(cur.ticket_cents), help: 'Receita ÷ número de vendas no período.', trend: ticketCmp.trend, trendLabel: ticketCmp.trendLabel, icon: <Receipt /> },
          { label: 'Conversão', value: fmtPct(pipeKpis.conversion_pct, 1), help: 'Oportunidades ganhas no período ÷ leads criados no período. Detalhe por estágio na aba Pipeline.', trend: convCmp.trend, trendLabel: convCmp.trendLabel, icon: <TrendingUp /> },
          {
            label: 'Meta mensal',
            value: goalPct !== null ? fmtPct(goalPct) : '—',
            help: 'Receita do mês calendário corrente x meta mensal da organização (Configurações › Metas). Independe dos filtros de período/vendedor.',
            trendLabel: goal ? `Faltam ${fmtCurrencyCompact(remaining)} de ${fmtCurrencyCompact(goal)}` : 'Meta não configurada',
            progressPct: goalPct ?? undefined,
            icon: <Target />,
          },
          {
            label: 'Pipeline previsto',
            value: fmtCurrencyCompact(open.weighted_value_cents),
            help: 'Soma do valor das oportunidades abertas × probabilidade de fechamento do estágio (histórico de 90 dias; sem histórico, peso por posição do estágio).',
            trendLabel: `de ${fmtCurrencyCompact(open.total_value_cents)} em oportunidades`,
            icon: <Gauge />,
          },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-8">
          <DashboardCard title="Receita x Meta" help="Receita realizada por mês (colunas) e meta mensal (linha), últimos 12 meses." icon={BarChart3} heightClass={MAIN_CARD_H}>
            {series.points.every(p => p.revenue_cents === 0) && !series.goalCents ? (
              <EmptyChart text="Nenhuma venda nos últimos 12 meses." />
            ) : (
              <BarLineChart
                data={series.points.map(p => ({ label: p.label, bar: p.revenue_cents, line: p.goal_cents, extra: [`${p.sales_count} venda(s)`] }))}
                barName="Receita"
                lineName="Meta"
                lineDashed
                lineColor="hsl(var(--foreground))"
              />
            )}
          </DashboardCard>
        </div>
        <div className="md:col-span-4">
          <DashboardCard title="Forecast do mês" help="Previsão de fechamento: realizado + pipeline ponderado vs. meta." icon={Flag} heightClass={MAIN_CARD_H}>
            <BulletForecast
              realizedCents={ctx.sellerId ? open.won_this_month_cents : monthGoal.realizedCents}
              probableCents={open.weighted_value_cents}
              possibleCents={Math.max(0, open.total_value_cents - open.weighted_value_cents)}
              goalCents={goal}
            />
          </DashboardCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-7">
          <DashboardCard
            title="Funil comercial"
            help={`Oportunidades criadas no período e até onde chegaram. Conversão geral: ${fmtPct(funnel.overall_pct, 1)}.`}
            icon={Filter}
            heightClass={TABLE_CARD_H}
            scroll
          >
            {funnel.total === 0 ? (
              <EmptyChart text="Nenhuma oportunidade criada no período." />
            ) : (
              <HorizontalFunnel steps={funnel.stages.map(s => ({ name: s.name, count: s.reached, conv_next_pct: s.conv_next_pct, color: s.color }))} />
            )}
          </DashboardCard>
        </div>
        <div className="md:col-span-5">
          <DashboardCard
            title="Pipeline em risco"
            help={`${atRisk.length} oportunidade(s) abertas sem interação há 3+ dias, por risco e valor.`}
            icon={AlertTriangle}
            iconClassName="text-destructive"
            heightClass={TABLE_CARD_H}
            scroll
          >
            <PipelineRiskList deals={atRisk} nameById={nameById} />
          </DashboardCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <BarListCard
            title="Receita por origem"
            help="Receita realizada no período, pela origem do cliente que comprou."
            icon={Megaphone}
            color="#0f62fe"
            rows={bySource.map(r => ({ label: r.source, value: r.revenue_cents, valueLabel: fmtCurrency0(r.revenue_cents), sublabel: `${r.sales_count} venda(s)` }))}
            emptyText="Nenhuma venda no período."
          />
        </div>
        <div className="md:col-span-6">
          <DashboardCard title="Top vendedores" help="Top 5 por receita no período. Meta = % da meta individual do mês." icon={Trophy} iconClassName="text-amber-500" heightClass={COMPACT_CARD_H} scroll>
            <TopSellersList sellers={team.filter(s => s.revenue_cents > 0)} />
          </DashboardCard>
        </div>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="visao-geral" />
      </Suspense>
    </div>
  )
}
