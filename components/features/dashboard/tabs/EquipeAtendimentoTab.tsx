import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getAiCreditsStatus, getAccountIdForOrgSlug } from '@/lib/plans/server'
import KpiCard from '../KpiCard'
import SellersRankingWidget from '../SellersRankingWidget'
import MockBarListCard from '../mocks/MockBarListCard'
import { MOCK_CONVERSION_BY_SELLER, MOCK_ASSIGNED_VS_WORKED } from '../mocks/mockData'
import { UserCheck, ListChecks } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

export default async function EquipeAtendimentoTab({ ctx }: { ctx: WidgetCtx }) {
  const accountId = await getAccountIdForOrgSlug(ctx.orgSlug)
  const credits = accountId ? await getAiCreditsStatus(accountId) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <SellersRankingWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} />
          </Suspense>
        </div>
        <div className="md:col-span-4">
          <MockBarListCard
            title="Conversão por vendedor"
            help="Percentual de leads atribuídos a cada vendedor que chegaram a um estágio de fechamento."
            icon={UserCheck}
            rows={MOCK_CONVERSION_BY_SELLER}
            color="#24a148"
          />
        </div>
        <div className="md:col-span-4">
          <MockBarListCard
            title="Leads atribuídos vs. trabalhados"
            help="Percentual de leads atribuídos a cada vendedor que já tiveram alguma interação registrada."
            icon={ListChecks}
            rows={MOCK_ASSIGNED_VS_WORKED}
            color="#8a3ffc"
          />
        </div>
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
