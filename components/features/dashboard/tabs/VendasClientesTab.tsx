import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getTicketMedio, getCustomerLTV, getCustomersByCity, getVipCustomers, getAtRiskCustomers } from '@/actions/dashboard-tabs'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import TopProductsWidget from '../TopProductsWidget'
import BarListCard from '../BarListCard'
import MockScatterCard from '../mocks/MockScatterCard'
import { Crown, MapPin, AlertTriangle } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function VendasClientesTab({ ctx }: { ctx: WidgetCtx }) {
  const [ticket, ltv, cities, vipCustomers, atRiskCustomers] = await Promise.all([
    getTicketMedio(ctx.orgId, sinceFromPeriod(ctx.period)),
    getCustomerLTV(ctx.orgId),
    getCustomersByCity(ctx.orgId),
    getVipCustomers(ctx.orgId),
    getAtRiskCustomers(ctx.orgId),
  ])

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
          value={fmtCurrency(ltv.avgLtvCents)}
          help={`Receita total histórica por cliente, média entre ${ltv.customersWithSales} cliente(s) com ao menos uma venda concluída.`}
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
          <BarListCard
            title="Clientes por cidade"
            help="Clientes ativos agrupados por cidade cadastrada."
            icon={MapPin}
            rows={cities.map(c => ({ label: c.city, value: c.customers, valueLabel: String(c.customers) }))}
            color="#0f62fe"
            emptyText="Nenhum cliente com cidade cadastrada."
          />
        </div>
        <div className="md:col-span-4">
          <BarListCard
            title="Clientes VIP"
            help="Top 5 clientes por valor total histórico comprado."
            icon={Crown}
            rows={vipCustomers.map(c => ({ label: c.name, value: c.total_cents, valueLabel: fmtCurrency(c.total_cents) }))}
            color="#f1c21b"
            emptyText="Nenhuma venda concluída registrada ainda."
          />
        </div>
        <div className="md:col-span-4">
          <BarListCard
            title="Clientes em risco"
            help="Clientes sem nenhuma compra há mais de 90 dias."
            icon={AlertTriangle}
            rows={atRiskCustomers.map(c => ({ label: c.name, value: c.days_since_last_sale, valueLabel: `${c.days_since_last_sale}d` }))}
            color="#da1e28"
            emptyText="Nenhum cliente parado há mais de 90 dias."
          />
        </div>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="vendas-clientes" />
      </Suspense>
    </div>
  )
}
