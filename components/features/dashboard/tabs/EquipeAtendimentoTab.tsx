import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getAiCreditsStatus, getAccountIdForOrgSlug } from '@/lib/plans/server'
import { getSellerConversionRates, getSellerOpenDeals, getSellerPerformanceScore } from '@/actions/dashboard-tabs'
import { getMonthlyRevenueGoal } from '@/actions/organization'
import { listOrgMembers } from '@/actions/sales'
import KpiCard from '../KpiCard'
import SellersRankingWidget from '../SellersRankingWidget'
import TasksTodayWidget from '../TasksTodayWidget'
import BarListCard from '../BarListCard'
import { UserCheck, ListChecks, Award } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function EquipeAtendimentoTab({ ctx }: { ctx: WidgetCtx }) {
  const accountId = await getAccountIdForOrgSlug(ctx.orgSlug)
  const [credits, conversionRates, openDeals, scores, monthlyGoalCents, members] = await Promise.all([
    accountId ? getAiCreditsStatus(accountId) : Promise.resolve(null),
    getSellerConversionRates(ctx.orgId),
    getSellerOpenDeals(ctx.orgId),
    getSellerPerformanceScore(ctx.orgId),
    getMonthlyRevenueGoal(ctx.orgSlug),
    listOrgMembers(ctx.orgSlug),
  ])
  const nameById = new Map(members.map((m: any) => [m.id, m.name]))
  const activeSellers = new Set([...conversionRates.map(c => c.seller_id), ...openDeals.map(o => o.seller_id)]).size
  const individualGoalCents = monthlyGoalCents && activeSellers > 0 ? Math.round(monthlyGoalCents / activeSellers) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Créditos de IA"
          value={credits ? `${credits.available}` : '—'}
          help="Créditos de IA disponíveis no plano atual para o mês corrente (incluídos + comprados − usados)."
        />
        <KpiCard
          label="Tempo médio de resposta"
          value="12 min"
          help="Tempo médio entre a mensagem do lead/cliente e a primeira resposta da equipe."
          mock
        />
        <KpiCard
          label="Taxa de resposta"
          value="87%"
          help="Percentual de conversas que receberam alguma resposta da equipe."
          mock
        />
        <KpiCard
          label="Reputação"
          value="4.7 ★"
          help="Nota média de avaliações públicas (ex.: Google Meu Negócio). Requer integração externa."
          mock
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Meta individual (média)"
          value={individualGoalCents === null ? '—' : fmtCurrency(individualGoalCents)}
          help="Meta mensal da empresa dividida igualmente entre os vendedores ativos — não há meta individual configurável por vendedor ainda."
          mock
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <SellersRankingWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} />
          </Suspense>
        </div>
        <div className="md:col-span-4">
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
        </div>
        <div className="md:col-span-4">
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
          <TasksTodayWidget orgId={ctx.orgId} orgSlug={ctx.orgSlug} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-12">
          <KpiCard
            label="Mensagens respondidas pela IA"
            value="342 no período"
            help="Quantidade de mensagens de clientes/leads respondidas automaticamente pela IA, sem intervenção humana."
            mock
            className="md:max-w-sm"
          />
        </div>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="equipe-atendimento" />
      </Suspense>
    </div>
  )
}
