import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import {
  getTicketMedio, getCustomerLTV, getCustomersByCity, getVipCustomers, getAtRiskCustomers,
  getRepurchaseRate, getCustomerSegmentation,
} from '@/actions/dashboard-tabs'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import BarListCard from '../BarListCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CityRevenueChart from '../CityRevenueChart'
import { COMPACT_CARD_H } from '../dashboardSizes'
import { Crown, MapPin, AlertTriangle, Layers } from 'lucide-react'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

const SEGMENT_LABEL: Record<string, string> = {
  novo: 'Novo',
  ativo: 'Ativo',
  recorrente: 'Recorrente',
  vip: 'VIP',
  em_risco: 'Em risco',
}
const SEGMENT_ORDER = ['novo', 'ativo', 'recorrente', 'vip', 'em_risco'] as const

/** Clientes — "quem são e como estão se comportando?". Foco em retenção e
 *  relacionamento, não é uma segunda página de vendas. */
export default async function ClientesTab({ ctx }: { ctx: WidgetCtx }) {
  const [ticket, ltv, cities, vipCustomers, atRiskCustomers, repurchase, segmentation] = await Promise.all([
    getTicketMedio(ctx.orgId, sinceFromPeriod(ctx.period)),
    getCustomerLTV(ctx.orgId),
    getCustomersByCity(ctx.orgId),
    getVipCustomers(ctx.orgId),
    getAtRiskCustomers(ctx.orgId),
    getRepurchaseRate(ctx.orgId),
    getCustomerSegmentation(ctx.orgId),
  ])

  const activeCustomers = segmentation.novo + segmentation.ativo + segmentation.recorrente + segmentation.vip

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Clientes ativos"
          value={String(activeCustomers)}
          help="Clientes com compra concluída, exceto os em risco (sem comprar há 90+ dias)."
        />
        <KpiCard
          label="Novos clientes"
          value={String(segmentation.novo)}
          help="Clientes com exatamente 1 compra, feita nos últimos 30 dias."
        />
        <KpiCard
          label="Clientes recorrentes"
          value={String(segmentation.recorrente)}
          help="Clientes com 2 ou mais compras (fora do grupo VIP), não em risco."
        />
        <KpiCard
          label="Taxa de recompra"
          value={`${repurchase.pct}%`}
          help={`${repurchase.repeatCustomers} de ${repurchase.totalCustomers} cliente(s) compraram mais de uma vez.`}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="LTV médio"
          value={fmtCurrency(ltv.avgLtvCents)}
          help={`Receita total histórica por cliente, média entre ${ltv.customersWithSales} cliente(s) com ao menos uma venda concluída.`}
        />
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticket.avg_cents)}
          help="Receita do período dividida pelo número de vendas concluídas."
        />
        <KpiCard
          label="Clientes VIP"
          value={String(segmentation.vip)}
          help="Clientes entre os 10% de maior valor total comprado (histórico completo), não em risco."
        />
        <KpiCard
          label="Clientes em risco"
          value={String(segmentation.em_risco)}
          help="Clientes com ao menos uma compra, sem nenhuma compra nova há 90+ dias."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BarListCard
          title="Segmentação de clientes"
          help="Distribuição por comportamento de compra: novo, ativo, recorrente, VIP e em risco."
          icon={Layers}
          rows={SEGMENT_ORDER.map(k => ({ label: SEGMENT_LABEL[k], value: segmentation[k], valueLabel: String(segmentation[k]) }))}
          color="#0f62fe"
          emptyText="Nenhum cliente com compra concluída ainda."
        />
        <BarListCard
          title="Clientes VIP"
          help="Top 5 clientes por valor total histórico comprado."
          icon={Crown}
          rows={vipCustomers.map(c => ({ label: c.name, value: c.total_cents, valueLabel: fmtCurrency(c.total_cents) }))}
          color="#f1c21b"
          emptyText="Nenhuma venda concluída registrada ainda."
        />
        <BarListCard
          title="Clientes em risco"
          help="Clientes sem nenhuma compra há mais de 90 dias, ordenados pelo mais tempo parado."
          icon={AlertTriangle}
          rows={atRiskCustomers.map(c => ({ label: c.name, value: c.days_since_last_sale, valueLabel: `${c.days_since_last_sale}d` }))}
          color="#da1e28"
          emptyText="Nenhum cliente parado há mais de 90 dias."
        />
        <Card className={`${COMPACT_CARD_H} flex flex-col overflow-hidden`}>
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Clientes por cidade
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {cities.some(c => c.commission_cents > 0)
                ? 'Barra = receita total (verde = comissão). Linha = nº de clientes.'
                : 'Barra = receita total. Linha = nº de clientes.'}
            </p>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            {cities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente com cidade cadastrada.</p>
            ) : (
              <CityRevenueChart rows={cities} hasCommission={cities.some(c => c.commission_cents > 0)} />
            )}
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="clientes" />
      </Suspense>
    </div>
  )
}
