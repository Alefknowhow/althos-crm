import { Suspense } from 'react'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getAiCreditsStatus, getAccountIdForOrgSlug } from '@/lib/plans/server'
import {
  getSellerConversionRates, getSellerOpenDeals, getSellerPerformanceScore,
  getResponseMetrics, getEffectiveSellerGoals, getAiAnsweredCount,
  getMonthlySalesBySeller, getSellerComparison,
} from '@/actions/dashboard-tabs'
import { getMonthlyRevenueGoal } from '@/actions/organization'
import { listOrgMembers } from '@/actions/sales'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import SellersRankingWidget from '../SellersRankingWidget'
import BarListCard from '../BarListCard'
import EquipeTeamSection from '../EquipeTeamSection'
import { UserCheck, ListChecks, Award } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

/** Equipe — "quem está performando e onde estão os gargalos?". */
export default async function EquipeTab({ ctx }: { ctx: WidgetCtx }) {
  const accountId = await getAccountIdForOrgSlug(ctx.orgSlug)
  const since = sinceFromPeriod(ctx.period)
  const [
    credits, conversionRates, openDeals, scores, monthlyGoalCents, members, response, aiAnswered,
    monthlySales, sellerComparison,
  ] = await Promise.all([
    accountId ? getAiCreditsStatus(accountId) : Promise.resolve(null),
    getSellerConversionRates(ctx.orgId),
    getSellerOpenDeals(ctx.orgId),
    getSellerPerformanceScore(ctx.orgId),
    getMonthlyRevenueGoal(ctx.orgSlug),
    listOrgMembers(ctx.orgSlug),
    getResponseMetrics(ctx.orgId, since),
    getAiAnsweredCount(ctx.orgId, since),
    getMonthlySalesBySeller(ctx.orgId, 6),
    getSellerComparison(ctx.orgId, since),
  ])
  const hasCommission = sellerComparison.some(r => r.commission_cents != null)
  const nameById = new Map(members.map((m: any) => [m.id, m.name]))
  const activeSellerIds = Array.from(new Set([...conversionRates.map(c => c.seller_id), ...openDeals.map(o => o.seller_id)]))

  // Meta individual: usa o valor configurado por vendedor (Configurações ›
  // Equipe) quando existir; senão cai no fallback (meta da empresa ÷ nº de
  // vendedores ativos). O KPI abaixo mostra a média entre os efetivos.
  const sellerGoals = await getEffectiveSellerGoals(ctx.orgId, activeSellerIds, monthlyGoalCents)
  const goalsWithValue = sellerGoals.filter(g => g.goal_cents !== null)
  const avgGoalCents = goalsWithValue.length > 0
    ? Math.round(goalsWithValue.reduce((a, g) => a + (g.goal_cents || 0), 0) / goalsWithValue.length)
    : null
  const anyIndividual = sellerGoals.some(g => g.is_individual)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Créditos de IA"
          value={credits ? `${credits.available}` : '—'}
          help="Créditos de IA disponíveis no plano atual para o mês corrente (incluídos + comprados − usados)."
        />
        <KpiCard
          label="Meta individual (média)"
          value={avgGoalCents === null ? '—' : fmtCurrency(avgGoalCents)}
          help={anyIndividual
            ? 'Média entre a meta individual configurada (quando houver) e o fallback — meta da empresa ÷ vendedores ativos, pra quem não tem meta própria. Configurável em Configurações › Equipe.'
            : 'Nenhum vendedor tem meta individual configurada ainda — mostrando a meta da empresa dividida igualmente entre os ativos. Configurável em Configurações › Equipe.'}
        />
        <KpiCard
          label="Tempo médio de resposta"
          value={response.avgResponseMinutes !== null ? fmtMinutes(response.avgResponseMinutes) : '—'}
          help="Tempo médio entre a mensagem do lead/cliente e a próxima resposta na mesma conversa (humana ou automática via IA), no período selecionado."
        />
        <KpiCard
          label="Taxa de resposta"
          value={response.responseRatePct !== null ? `${response.responseRatePct}%` : '—'}
          help={`Percentual de mensagens recebidas que tiveram alguma resposta depois, no período (${response.answeredCount} de ${response.inboundCount}).`}
        />
        <KpiCard
          label="Mensagens respondidas pela IA"
          value={String(aiAnswered)}
          help="Mensagens de clientes/leads respondidas automaticamente pela IA (sem intervenção humana) no período selecionado."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Suspense fallback={<div className="h-[320px] w-full rounded-md bg-muted/30 animate-pulse" />}>
          <SellersRankingWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} />
        </Suspense>
        <BarListCard
          title="Conversão por vendedor"
          help="Percentual de leads atribuídos a cada vendedor (últimos 30 dias) que chegaram a um estágio de fechamento."
          icon={UserCheck}
          rows={conversionRates.map(c => ({
            label: nameById.get(c.seller_id) || 'Usuário removido',
            value: c.conversion_pct,
            valueLabel: `${c.conversion_pct.toFixed(0)}%`,
          }))}
          color="#24a148"
          emptyText="Nenhum lead atribuído nos últimos 30 dias."
        />
        <BarListCard
          title="Negociações abertas por vendedor"
          help="Quantidade de negócios em aberto atribuídos a cada vendedor no momento."
          icon={ListChecks}
          rows={openDeals.map(o => ({
            label: nameById.get(o.seller_id) || 'Usuário removido',
            value: o.open_deals,
            valueLabel: String(o.open_deals),
          }))}
          color="#8a3ffc"
          emptyText="Nenhuma negociação aberta atribuída."
        />
        <BarListCard
          title="Score de performance"
          help="Média entre a posição relativa em valor vendido e em taxa de conversão, ambas normalizadas pelo melhor vendedor do período (30 dias)."
          icon={Award}
          rows={scores.map(s => ({
            label: nameById.get(s.seller_id) || 'Usuário removido',
            value: s.score,
            valueLabel: `${s.score}`,
          }))}
          color="#0f62fe"
          emptyText="Sem vendas ou leads atribuídos nos últimos 30 dias."
        />
      </div>

      <EquipeTeamSection
        monthlyRows={monthlySales}
        comparisonRows={sellerComparison}
        sellers={members.map((m: any) => ({ id: m.id, name: m.name }))}
        hasCommission={hasCommission}
      />

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="equipe" />
      </Suspense>
    </div>
  )
}
