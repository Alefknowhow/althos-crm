import { getImoveisDashboardMetrics } from '@/actions/dashboard-imoveis'
import KpiCard from '../KpiCard'
import BarListCard from '../BarListCard'
import { Home, FileSignature, CheckCircle2, CalendarClock, Wallet } from 'lucide-react'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/** Aba "Imobiliária" — só renderizada quando o nicho da org é
 *  Imobiliária (ver isModuleEnabled/isRealEstateNiche no page.tsx).
 *  Todas as métricas vêm de dado real (properties/property_visits/
 *  property_proposals/property_deals/financial_entries) — sem
 *  placeholder. Fase 5 da vertical. */
export default async function ImobiliariaTab({ orgSlug }: { orgSlug: string }) {
  const m = await getImoveisDashboardMetrics(orgSlug)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard
          label="Imóveis disponíveis"
          value={`${m.availableCount}`}
          help="Imóveis com status 'disponível' no estoque atual."
          icon={<Home />}
        />
        <KpiCard
          label="Vendidos/alugados (30d)"
          value={`${m.closedCount30d}`}
          help="Negócios fechados (venda ou locação) nos últimos 30 dias."
          icon={<CheckCircle2 />}
        />
        <KpiCard
          label="Visitas nos próx. 7 dias"
          value={`${m.visitsUpcoming7d}`}
          help="Visitas agendadas ou confirmadas com data nos próximos 7 dias."
          icon={<CalendarClock />}
        />
        <KpiCard
          label="Comissão pendente"
          value={fmtCurrency(m.pendingCommissionCents)}
          help="Soma das comissões de negócios fechados ainda não marcadas como pagas no Financeiro."
          icon={<Wallet />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BarListCard
          title="Propostas por status (30d)"
          help="Contagem de propostas criadas nos últimos 30 dias, por status atual."
          icon={FileSignature}
          rows={m.proposalsByStatus}
          color="var(--chart-1)"
        />
        <BarListCard
          title="Estoque disponível por cidade"
          help="Imóveis com status 'disponível', agrupados por cidade."
          icon={Home}
          rows={m.propertiesByCity}
          color="var(--chart-2)"
        />
      </div>
    </div>
  )
}
