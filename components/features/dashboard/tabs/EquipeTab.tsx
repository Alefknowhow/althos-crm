import { Suspense } from 'react'
import { DollarSign, Percent, Target, Clock, MessageCircle, Briefcase, Table2, UserCheck, Wallet, ListChecks, Timer, MessageSquareReply, Award, BarChart3 } from 'lucide-react'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDates } from '@/actions/dashboard'
import { listOrgMembers } from '@/actions/sales'
import { getTeamPerformance, buildScoreComposition, type SellerPerf } from '@/actions/dashboard-v2-team'
import { getMonthlyRevenueSeries } from '@/actions/dashboard-v2-sales'
import { fmtCurrency0, fmtCurrencyCompact, fmtDays, fmtMinutes, fmtPct } from '@/lib/dashboard/format'
import KpiRow from '../KpiRow'
import DashboardCard, { EmptyChart } from '../DashboardCard'
import BarListCard from '../BarListCard'
import BarLineChart from '../charts/BarLineChart'
import TeamPerformanceTable from '../lists/TeamPerformanceTable'
import SellerComparisonCard from '../SellerComparisonCard'
import MonthlyDetailsDialog from '../MonthlyDetailsDialog'
import { MAIN_CARD_H, TABLE_CARD_H } from '../dashboardSizes'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function avgOf(rows: SellerPerf[], pick: (r: SellerPerf) => number | null): number | null {
  const v = rows.map(pick).filter((x): x is number => x !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/**
 * Equipe — performance individual e meta individual: "quem está
 * performando e onde estão os gargalos?". Com um vendedor selecionado no
 * filtro de topo, os KPIs refletem só ele; os comparativos continuam
 * mostrando o time inteiro (com o selecionado em destaque).
 */
export default async function EquipeTab({ ctx }: { ctx: WidgetCtx }) {
  const range = getDates(ctx.period)
  const members = (await listOrgMembers(ctx.orgSlug)).map((m: any) => ({ id: m.id as string, name: m.name as string }))
  const [team, series] = await Promise.all([
    getTeamPerformance(ctx.orgId, members, { since: range.start }),
    getMonthlyRevenueSeries(ctx.orgId, { months: 12, sellerId: ctx.sellerId }),
  ])

  const focus = ctx.sellerId ? team.filter(t => t.seller_id === ctx.sellerId) : team
  const who = ctx.sellerId ? focus[0]?.name ?? 'Vendedor' : 'Equipe'
  const revenue = focus.reduce((a, r) => a + r.revenue_cents, 0)
  const monthRevenue = focus.reduce((a, r) => a + r.month_revenue_cents, 0)
  const goals = focus.reduce((a, r) => a + (r.goal_cents || 0), 0)
  const goalPct = goals > 0 ? (monthRevenue / goals) * 100 : null
  const conv = avgOf(focus, r => r.conversion_pct)
  const resp = avgOf(focus, r => r.avg_response_min)
  const rate = avgOf(focus, r => r.response_rate_pct)
  const openDeals = focus.reduce((a, r) => a + r.open_deals, 0)
  const openValue = focus.reduce((a, r) => a + r.open_value_cents, 0)
  const sellersWithRevenue = focus.filter(r => r.revenue_cents > 0).length

  const score = buildScoreComposition(team, focus)
  const hasCommission = series.points.some(p => p.commission_cents !== null)
  const avgConv = avgOf(team, r => r.conversion_pct)

  return (
    <div className="space-y-5">
      <KpiRow
        items={[
          {
            label: ctx.sellerId ? 'Receita do vendedor' : 'Receita por vendedor',
            value: fmtCurrency0(revenue),
            help: 'Receita realizada no período atribuída a vendedores (soma). Com vendedor selecionado, só dele.',
            trendLabel: !ctx.sellerId && sellersWithRevenue > 0 ? `média ${fmtCurrencyCompact(revenue / sellersWithRevenue)} por vendedor` : undefined,
            icon: <DollarSign />,
          },
          { label: 'Conversão média', value: fmtPct(conv, 1), help: 'Média da conversão (ganhos ÷ leads atribuídos no período) entre os vendedores.', icon: <Percent /> },
          {
            label: 'Meta atingida',
            value: fmtPct(goalPct),
            help: 'Receita do mês corrente ÷ soma das metas individuais (Configurações › Equipe; sem meta individual, meta da empresa ÷ vendedores ativos).',
            trendLabel: goals > 0 ? `${fmtCurrencyCompact(monthRevenue)} de ${fmtCurrencyCompact(goals)}` : 'Sem meta configurada',
            progressPct: goalPct ?? undefined,
            icon: <Target />,
          },
          { label: 'Tempo médio de resposta', value: fmtMinutes(resp), help: 'Tempo entre a mensagem do cliente e a próxima resposta, em conversas de WhatsApp atribuídas ao vendedor, no período.', icon: <Clock /> },
          { label: 'Taxa de resposta', value: fmtPct(rate), help: '% das mensagens recebidas (em conversas atribuídas) que tiveram resposta, no período.', icon: <MessageCircle /> },
          { label: 'Oportunidades ativas', value: String(openDeals), help: 'Oportunidades abertas atribuídas a vendedores agora.', trendLabel: `${fmtCurrencyCompact(openValue)} em aberto`, icon: <Briefcase /> },
        ]}
      />

      <DashboardCard title="Performance dos vendedores" help={`Período selecionado · ordenado por receita${ctx.sellerId ? ` · ${who} em destaque` : ''}.`} icon={Table2} heightClass={TABLE_CARD_H} scroll>
        <TeamPerformanceTable rows={team} selectedId={ctx.sellerId} />
      </DashboardCard>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <BarListCard
            title="Conversão por vendedor"
            help="Ganhos ÷ leads atribuídos no período."
            icon={UserCheck}
            color="#24a148"
            maxValue={100}
            referenceValue={avgConv ?? undefined}
            referenceLabel={avgConv !== null ? `Média do time: ${fmtPct(avgConv, 1)}` : undefined}
            rows={team.filter(t => t.conversion_pct !== null).sort((a, b) => b.conversion_pct! - a.conversion_pct!)
              .map(t => ({ label: t.name, value: t.conversion_pct!, valueLabel: fmtPct(t.conversion_pct), sublabel: `${t.won}/${t.leads}` }))}
            emptyText="Nenhum lead atribuído no período."
          />
        </div>
        <div className="md:col-span-6">
          <BarListCard
            title="Receita por vendedor"
            help="Receita realizada no período."
            icon={Wallet}
            color="#0f62fe"
            rows={team.filter(t => t.revenue_cents > 0).map(t => ({ label: t.name, value: t.revenue_cents, valueLabel: fmtCurrencyCompact(t.revenue_cents), sublabel: `${t.sales_count} venda(s)` }))}
            emptyText="Nenhuma venda atribuída no período."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4">
          <BarListCard
            title="Negociações por vendedor"
            help="Oportunidades abertas agora."
            icon={ListChecks}
            color="#8a3ffc"
            rows={team.filter(t => t.open_deals > 0).sort((a, b) => b.open_deals - a.open_deals)
              .map(t => ({ label: t.name, value: t.open_deals, valueLabel: String(t.open_deals), sublabel: fmtCurrencyCompact(t.open_value_cents) }))}
            emptyText="Nenhuma negociação aberta."
          />
        </div>
        <div className="md:col-span-4">
          <BarListCard
            title="Ciclo médio por vendedor"
            help="Dias da criação ao ganho (menor é melhor)."
            icon={Timer}
            color="#1192e8"
            rows={team.filter(t => t.avg_cycle_days !== null).sort((a, b) => a.avg_cycle_days! - b.avg_cycle_days!)
              .map(t => ({ label: t.name, value: t.avg_cycle_days!, valueLabel: fmtDays(t.avg_cycle_days) }))}
            emptyText="Nenhuma venda fechada no período."
          />
        </div>
        <div className="md:col-span-4">
          <BarListCard
            title="Tempo de resposta por vendedor"
            help="Média no WhatsApp, conversas atribuídas (menor é melhor)."
            icon={MessageSquareReply}
            color="#005d5d"
            rows={team.filter(t => t.avg_response_min !== null).sort((a, b) => a.avg_response_min! - b.avg_response_min!)
              .map(t => ({ label: t.name, value: t.avg_response_min!, valueLabel: fmtMinutes(t.avg_response_min), sublabel: t.response_rate_pct !== null ? `${fmtPct(t.response_rate_pct)} resp.` : undefined }))}
            emptyText="Sem conversas atribuídas no período."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4">
          <BarListCard
            title={`Score de performance · ${who}`}
            help="Composição 0-100 por critério: conversão (vs. melhor do time), meta, tempo de resposta (100 até 5 min, 0 em 4h), follow-up (abertas com interação em 7 dias) e ciclo (vs. menor do time)."
            icon={Award}
            color="#0f62fe"
            heightClass={MAIN_CARD_H}
            maxValue={100}
            rows={score.map(s => ({ label: s.label, value: s.score ?? 0, valueLabel: s.score !== null ? String(s.score) : '—', highlight: s.score === null ? s.detail : undefined }))}
          />
        </div>
        <div className="md:col-span-8">
          <DashboardCard
            title={`Faturamento${hasCommission ? ' e comissão' : ''} por mês`}
            help={hasCommission ? 'Colunas = faturamento (eixo esquerdo), linha = comissão (eixo direito). Últimos 12 meses.' : 'Faturamento mensal, últimos 12 meses.'}
            icon={BarChart3}
            heightClass={MAIN_CARD_H}
            action={<MonthlyDetailsDialog hasCommission={hasCommission} rows={series.points.map(p => ({ label: p.label, revenue_cents: p.revenue_cents, commission_cents: p.commission_cents, sales_count: p.sales_count }))} />}
          >
            {series.points.every(p => p.revenue_cents === 0) ? (
              <EmptyChart text="Nenhuma venda nos últimos 12 meses." />
            ) : (
              <BarLineChart
                data={series.points.map(p => ({ label: p.label, bar: p.revenue_cents, line: p.commission_cents, extra: [`${p.sales_count} venda(s)`] }))}
                barName="Faturamento"
                lineName="Comissão"
                dualAxis={hasCommission}
              />
            )}
          </DashboardCard>
        </div>
      </div>

      <SellerComparisonCard
        selectedId={ctx.sellerId}
        sellers={team.map(t => ({
          id: t.seller_id,
          name: t.name,
          revenue_cents: t.revenue_cents,
          sales_count: t.sales_count,
          conversion_pct: t.conversion_pct,
          ticket_cents: t.ticket_cents,
          goal_pct: t.goal_pct,
          avg_cycle_days: t.avg_cycle_days,
        }))}
      />

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="equipe" />
      </Suspense>
    </div>
  )
}
