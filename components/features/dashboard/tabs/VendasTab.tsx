import { Suspense } from 'react'
import { DollarSign, ShoppingCart, Receipt, Target, Coins, Percent, BarChart3, Flag, MapPin, Package, Megaphone, LineChart, PieChart } from 'lucide-react'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDates } from '@/actions/dashboard'
import { getSalesTotals, getMonthlyRevenueSeries, getMonthGoalProgress, getRevenueBySource, getTopItems, getSalesMix } from '@/actions/dashboard-v2-sales'
import { getOpenPipeline } from '@/actions/dashboard-v2-pipeline'
import { compareValues, comparePoints } from '@/lib/dashboard/compare'
import { fmtCurrency0, fmtCurrencyCompact, fmtPct } from '@/lib/dashboard/format'
import { carbonColor } from '@/lib/charts/carbon-theme'
import KpiRow from '../KpiRow'
import DashboardCard, { EmptyChart } from '../DashboardCard'
import BarListCard from '../BarListCard'
import BarLineChart from '../charts/BarLineChart'
import MultiLineChart from '../charts/MultiLineChart'
import BulletForecast from '../charts/BulletForecast'
import StackedShareBar from '../charts/StackedShareBar'
import { MAIN_CARD_H, STRIP_CARD_H } from '../dashboardSizes'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

const NO_COMMISSION = 'Comissão por venda só existe no nicho Viagens (travel_sales.commission_cents).'

/**
 * Vendas — receita realizada: "o que efetivamente vendemos, o quê, de onde
 * e com que comissão?". Casa de Receita, Comissão e Receita por origem.
 */
export default async function VendasTab({ ctx }: { ctx: WidgetCtx }) {
  const range = getDates(ctx.period)
  const [sales, series, monthGoal, open, topItems, bySource, mix] = await Promise.all([
    getSalesTotals(ctx.orgId, range, ctx.sellerId),
    getMonthlyRevenueSeries(ctx.orgId, { months: 12, sellerId: ctx.sellerId }),
    getMonthGoalProgress(ctx.orgId),
    getOpenPipeline(ctx.orgId, { pipelineId: ctx.pipelineId, sellerId: ctx.sellerId }),
    getTopItems(ctx.orgId, range.start, { sellerId: ctx.sellerId, limit: 8 }),
    getRevenueBySource(ctx.orgId, range.start, ctx.sellerId),
    getSalesMix(ctx.orgId, range.start, ctx.sellerId),
  ])

  const cur = sales.current
  const prev = sales.previous
  const hasCommission = sales.hasCommission
  const revenueCmp = compareValues(cur.revenue_cents, prev?.revenue_cents)
  const salesCmp = compareValues(cur.sales_count, prev?.sales_count)
  const ticketCmp = compareValues(cur.ticket_cents, prev?.ticket_cents)
  const commCmp = compareValues(cur.commission_cents, prev?.commission_cents)
  const marginPct = cur.revenue_cents > 0 ? (cur.commission_cents / cur.revenue_cents) * 100 : null
  const prevMarginPct = prev && prev.revenue_cents > 0 ? (prev.commission_cents / prev.revenue_cents) * 100 : null
  const marginCmp = comparePoints(marginPct ?? 0, prevMarginPct)

  const goal = monthGoal.goalCents
  const goalPct = goal && goal > 0 ? (monthGoal.realizedCents / goal) * 100 : null
  const realizedMonth = ctx.sellerId ? open.won_this_month_cents : monthGoal.realizedCents

  const itemTitle = topItems.isTravel ? 'Top destinos' : 'Top produtos'
  const commissionPoints = series.points

  return (
    <div className="space-y-5">
      <KpiRow
        items={[
          { label: 'Receita', value: fmtCurrency0(cur.revenue_cents), help: 'Receita realizada (vendas concluídas) no período.', trend: revenueCmp.trend, trendLabel: revenueCmp.trendLabel, icon: <DollarSign /> },
          { label: 'Vendas', value: String(cur.sales_count), help: 'Quantidade de vendas concluídas no período.', trend: salesCmp.trend, trendLabel: salesCmp.trendLabel, icon: <ShoppingCart /> },
          { label: 'Ticket médio', value: fmtCurrency0(cur.ticket_cents), help: 'Receita ÷ número de vendas no período.', trend: ticketCmp.trend, trendLabel: ticketCmp.trendLabel, icon: <Receipt /> },
          {
            label: 'Meta do mês',
            value: goalPct !== null ? fmtPct(goalPct) : '—',
            help: 'Receita do mês calendário corrente x meta mensal da organização (Configurações › Metas).',
            trendLabel: goal ? `${fmtCurrencyCompact(monthGoal.realizedCents)} de ${fmtCurrencyCompact(goal)}` : 'Meta não configurada',
            progressPct: goalPct ?? undefined,
            icon: <Target />,
          },
          {
            label: 'Comissão',
            value: hasCommission ? fmtCurrency0(cur.commission_cents) : '—',
            help: hasCommission ? 'Soma da comissão das vendas do período.' : NO_COMMISSION,
            trend: hasCommission ? commCmp.trend : undefined,
            trendLabel: hasCommission ? commCmp.trendLabel : 'Não se aplica ao nicho',
            icon: <Coins />,
          },
          {
            label: 'Comissão média',
            value: hasCommission ? fmtPct(marginPct, 1) : '—',
            help: hasCommission ? 'Comissão ÷ receita no período (margem média de comissão).' : NO_COMMISSION,
            trend: hasCommission ? marginCmp.trend : undefined,
            trendLabel: hasCommission ? marginCmp.trendLabel : 'Não se aplica ao nicho',
            icon: <Percent />,
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
                data={series.points.map(p => ({ label: p.label, bar: p.revenue_cents, line: p.goal_cents, extra: [`${p.sales_count} venda(s)`, p.goal_cents ? `${fmtPct((p.revenue_cents / p.goal_cents) * 100)} da meta` : ''].filter(Boolean) }))}
                barName="Receita"
                lineName="Meta"
                lineDashed
                lineColor="hsl(var(--foreground))"
              />
            )}
          </DashboardCard>
        </div>
        <div className="md:col-span-4">
          <DashboardCard title="Forecast" help="Fechamento do mês: realizado + forecast provável (ponderado) + otimista (restante do aberto) vs. meta." icon={Flag} heightClass={MAIN_CARD_H}>
            <BulletForecast
              realizedCents={realizedMonth}
              probableCents={open.weighted_value_cents}
              possibleCents={Math.max(0, open.total_value_cents - open.weighted_value_cents)}
              goalCents={goal}
              labels={{ realized: 'Realizado', probable: 'Forecast provável', possible: 'Forecast otimista' }}
            />
          </DashboardCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <BarListCard
            title={itemTitle}
            help={topItems.isTravel ? 'Destinos por receita no período · vendas · ticket médio.' : 'Produtos por receita no período · vendas · ticket médio.'}
            icon={topItems.isTravel ? MapPin : Package}
            color="#8a3ffc"
            rows={topItems.rows.map(r => ({ label: r.item, value: r.revenue_cents, valueLabel: fmtCurrencyCompact(r.revenue_cents), sublabel: `${r.sales_count} venda(s) · ${fmtCurrencyCompact(r.ticket_cents)}` }))}
            emptyText={topItems.isTravel ? 'Nenhuma venda com destino no período.' : 'Nenhuma venda com produto vinculado no período.'}
          />
        </div>
        <div className="md:col-span-6">
          <BarListCard
            title="Receita por origem"
            help="Receita realizada no período, pela origem do cliente que comprou."
            icon={Megaphone}
            color="#0f62fe"
            rows={bySource.map(r => ({ label: r.source, value: r.revenue_cents, valueLabel: fmtCurrencyCompact(r.revenue_cents), sublabel: `${r.sales_count} venda(s)` }))}
            emptyText="Nenhuma venda no período."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-8">
          <DashboardCard title="Receita x Comissão" help="Faturamento por mês (colunas, eixo esquerdo) e comissão (linha, eixo direito), últimos 12 meses." icon={BarChart3} heightClass={MAIN_CARD_H}>
            {!hasCommission ? (
              <EmptyChart text="Sem dados de comissão." hint={NO_COMMISSION} />
            ) : (
              <BarLineChart
                data={commissionPoints.map(p => ({ label: p.label, bar: p.revenue_cents, line: p.commission_cents, extra: p.commission_pct !== null ? [`Comissão: ${fmtPct(p.commission_pct, 1)} da receita`] : [] }))}
                barName="Faturamento"
                lineName="Comissão"
                dualAxis
              />
            )}
          </DashboardCard>
        </div>
        <div className="md:col-span-4">
          <DashboardCard title="Comissão %" help="Comissão ÷ faturamento, mês a mês." icon={LineChart} heightClass={MAIN_CARD_H}>
            {!hasCommission ? (
              <EmptyChart text="Sem dados de comissão." hint={NO_COMMISSION} />
            ) : (
              <MultiLineChart
                format="pct"
                data={commissionPoints.map(p => ({ label: p.label, pct: p.commission_pct }))}
                series={[{ key: 'pct', name: 'Comissão %', color: '#8a3ffc' }]}
              />
            )}
          </DashboardCard>
        </div>
      </div>

      <DashboardCard
        title="Mix de vendas"
        help={topItems.isTravel
          ? 'Participação de cada tipo de venda na receita do período (classificado pelos itens inclusos da reserva: aéreo + hospedagem = pacote).'
          : 'Participação de cada categoria de produto na receita do período.'}
        icon={PieChart}
        heightClass={STRIP_CARD_H}
      >
        {mix.length === 0 ? (
          <EmptyChart text="Nenhuma venda no período." />
        ) : (
          <StackedShareBar
            segments={mix.slice(0, 8).map((m, i) => ({ label: m.category, value: m.revenue_cents, valueLabel: fmtCurrencyCompact(m.revenue_cents), color: carbonColor(i) }))
              .concat(mix.length > 8 ? [{ label: 'Outros', value: mix.slice(8).reduce((a, m) => a + m.revenue_cents, 0), valueLabel: fmtCurrencyCompact(mix.slice(8).reduce((a, m) => a + m.revenue_cents, 0)), color: '#8d8d8d' }] : [])}
          />
        )}
      </DashboardCard>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="vendas" />
      </Suspense>
    </div>
  )
}
