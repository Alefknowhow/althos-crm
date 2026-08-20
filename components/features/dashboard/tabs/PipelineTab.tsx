import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getAverageTimePerStage } from '@/actions/dashboard'
import { getTicketMedio } from '@/actions/dashboard-tabs'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import ConversionFunnelWidget from '../ConversionFunnelWidget'
import LeadSourcesWidget from '../LeadSourcesWidget'
import PipelineAtRiskWidget from '../PipelineAtRiskWidget'
import SourcePerformanceWidget from '../SourcePerformanceWidget'
import TimeInStageWidget from '../TimeInStageWidget'
import MockBarListCard from '../mocks/MockBarListCard'
import { MOCK_LOSS_REASONS } from '../mocks/mockData'
import { TrendingDown } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/**
 * Pipeline — "o que está em andamento e quanto dá pra vender?". Representa
 * o futuro (oportunidades abertas), não resultado já fechado — isso mora
 * na aba Vendas.
 */
export default async function PipelineTab({ ctx }: { ctx: WidgetCtx }) {
  const [ticket, timeInStage] = await Promise.all([
    getTicketMedio(ctx.orgId, sinceFromPeriod(ctx.period)),
    getAverageTimePerStage(ctx.orgId, { pipelineId: ctx.pipelineId }),
  ])

  const funnel = ctx.initialFunnel
  const avgCycleDays = timeInStage.reduce((a, s) => a + s.avg_days, 0)
  // Velocidade do pipeline = oportunidades × ticket médio × conversão ÷ ciclo
  // médio — quanto de receita o funil "produz" por dia, no ritmo atual.
  const velocityCentsPerDay = avgCycleDays > 0
    ? Math.round((funnel.total_leads * ticket.avg_cents * (funnel.overall_conversion_pct / 100)) / avgCycleDays)
    : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Leads no período"
          value={String(funnel.total_leads)}
          help="Leads criados no período selecionado, dentro do filtro de pipeline/origem atual."
        />
        <KpiCard
          label="Pipeline total"
          value={fmtCurrency(funnel.total_value_cents)}
          help="Soma do valor de todas as oportunidades em aberto no funil."
        />
        <KpiCard
          label="Conversão geral"
          value={`${funnel.overall_conversion_pct.toFixed(1)}%`}
          help="Percentual de leads que chegaram até o último estágio do funil."
        />
        <KpiCard
          label="Ciclo médio"
          value={avgCycleDays > 0 ? `${avgCycleDays.toFixed(0)} dias` : '—'}
          help="Soma do tempo médio que os leads passam em cada estágio, últimos 90 dias."
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticket.avg_cents)}
          help="Receita do período dividida pelo número de vendas concluídas."
        />
        <KpiCard
          label="Velocidade do pipeline"
          value={avgCycleDays > 0 ? `${fmtCurrency(velocityCentsPerDay)}/dia` : '—'}
          help="Leads × ticket médio × taxa de conversão ÷ ciclo médio — quanto de receita o funil produz por dia, no ritmo atual."
        />
        <KpiCard
          label="Oportunidades"
          value={String(funnel.first_stage_count)}
          help="Leads atualmente no primeiro estágio do funil."
        />
        <KpiCard
          label="Fechados"
          value={String(funnel.last_stage_count)}
          help="Leads atualmente no último estágio do funil, na janela selecionada."
        />
      </div>

      <Suspense fallback={<Skeleton className="h-[340px] w-full" />}>
        <ConversionFunnelWidget
          orgSlug={ctx.orgSlug}
          pipelineId={ctx.pipelineId}
          initialResult={ctx.initialFunnel}
          sourceOptions={ctx.funnelSourceOptions}
        />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <LeadSourcesWidget orgId={ctx.orgId} period={ctx.period} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <SourcePerformanceWidget orgId={ctx.orgId} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <TimeInStageWidget orgId={ctx.orgId} pipelineId={ctx.pipelineId} />
          </Suspense>
        </div>
        <div className="md:col-span-6">
          <MockBarListCard
            title="Motivos de perda"
            help="Distribuição dos motivos de negociações perdidas — depende de um campo de motivo de perda, que ainda não existe no cadastro do lead."
            icon={TrendingDown}
            rows={MOCK_LOSS_REASONS}
            color="#da1e28"
          />
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
        <PipelineAtRiskWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} pipelineId={ctx.pipelineId} />
      </Suspense>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="pipeline" />
      </Suspense>
    </div>
  )
}
