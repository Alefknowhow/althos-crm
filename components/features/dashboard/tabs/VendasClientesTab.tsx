import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getTicketMedio } from '@/actions/dashboard-tabs'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import TopProductsWidget from '../TopProductsWidget'
import MockDonutCard from '../mocks/MockDonutCard'
import MockBarListCard from '../mocks/MockBarListCard'
import MockScatterCard from '../mocks/MockScatterCard'
import { MOCK_CUSTOMER_SEGMENTS, MOCK_NEW_VS_RETURNING, MOCK_TOP_CUSTOMERS } from '../mocks/mockData'
import { Crown } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function VendasClientesTab({ ctx }: { ctx: WidgetCtx }) {
  const ticket = await getTicketMedio(ctx.orgId, sinceFromPeriod(ctx.period))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Faturamento"
          value={fmtCurrency(ticket.revenue_cents)}
          help="Soma das vendas concluídas no período selecionado."
        />
        <KpiCard
          label="Vendas fechadas"
          value={String(ticket.sales_count)}
          help="Número de vendas concluídas no período selecionado."
        />
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticket.avg_cents)}
          help="Receita do período dividida pelo número de vendas concluídas."
        />
        <KpiCard
          label="LTV médio"
          value={fmtCurrency(280000)}
          help="Valor total médio que um cliente gera durante todo o relacionamento com a empresa."
          mock
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6">
          <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
            <TopProductsWidget orgId={ctx.orgId} since={sinceFromPeriod(ctx.period)} />
          </Suspense>
        </div>
        <div className="md:col-span-6">
          <MockScatterCard />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4">
          <MockDonutCard
            title="Segmentos de cliente"
            help="Distribuição da carteira de clientes por segmento de valor."
            segments={MOCK_CUSTOMER_SEGMENTS}
          />
        </div>
        <div className="md:col-span-4">
          <MockDonutCard
            title="Novos vs. recorrentes"
            help="Proporção de clientes na primeira compra vs. clientes que já compraram antes, no período."
            segments={MOCK_NEW_VS_RETURNING}
          />
        </div>
        <div className="md:col-span-4">
          <MockBarListCard
            title="Clientes que mais compram"
            help="Clientes com mais compras registradas no período."
            icon={Crown}
            rows={MOCK_TOP_CUSTOMERS}
            color="#f1c21b"
          />
        </div>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="vendas-clientes" />
      </Suspense>
    </div>
  )
}
