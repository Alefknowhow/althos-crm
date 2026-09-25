import { Suspense } from 'react'
import { Users, UserPlus, RefreshCw, Wallet, Smile, AlertTriangle, LineChart, Layers, Crown, MapPin, Gem } from 'lucide-react'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getDates } from '@/actions/dashboard'
import { getNpsScore, getCustomersByCity } from '@/actions/dashboard-tabs'
import { getCustomerBase, SEGMENTS, SEGMENT_LABEL, type Segment } from '@/actions/dashboard-v2-customers'
import { listOrgMembers } from '@/actions/sales'
import { fmtCurrency0, fmtCurrencyCompact, fmtPct } from '@/lib/dashboard/format'
import KpiRow from '../KpiRow'
import DashboardCard, { EmptyChart } from '../DashboardCard'
import BarListCard from '../BarListCard'
import MultiLineChart from '../charts/MultiLineChart'
import NpsBreakdown from '../charts/NpsBreakdown'
import StackedShareBar from '../charts/StackedShareBar'
import CustomerTable from '../lists/CustomerTable'
import { MAIN_CARD_H, TABLE_CARD_H, COMPACT_CARD_H } from '../dashboardSizes'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'

/** Cor fixa por segmento (segue a entidade, não o ranking). */
const SEGMENT_COLOR: Record<Segment, string> = {
  novo: '#1192e8',
  ativo: '#0f62fe',
  recorrente: '#24a148',
  vip: '#8a3ffc',
  dormente: '#a8a8a8',
  risco: '#fa4d56',
}

/** Clientes/Pacientes — "quem são e como estão se comportando?". Casa do
 *  LTV, retenção e relacionamento. No nicho Clínicas os rótulos viram
 *  "paciente" (mesmo dado por baixo). */
export default async function ClientesTab({ ctx, isClinic = false }: { ctx: WidgetCtx; isClinic?: boolean }) {
  const who = isClinic ? 'Paciente' : 'Cliente'
  const whoPlural = isClinic ? 'Pacientes' : 'Clientes'
  const whoLower = who.toLowerCase()
  const range = getDates(ctx.period)

  const [base, nps, cities, members] = await Promise.all([
    getCustomerBase(ctx.orgId, range.start),
    getNpsScore(ctx.orgId),
    getCustomersByCity(ctx.orgId, 10),
    listOrgMembers(ctx.orgSlug),
  ])
  const nameById = Object.fromEntries(members.map((m: any) => [m.id, m.name]))
  const hasBase = base.totalCustomers > 0

  return (
    <div className="space-y-5">
      <KpiRow
        items={[
          { label: `${whoPlural} ativos`, value: String(base.active), help: `${whoPlural} com compra nos últimos 90 dias (novos, ativos, recorrentes e VIP).`, trendLabel: `de ${base.totalCustomers} com compra`, icon: <Users /> },
          { label: `Novos ${whoLower}s`, value: String(base.newInPeriod), help: `${whoPlural} cuja primeira compra aconteceu no período selecionado.`, icon: <UserPlus /> },
          { label: 'Taxa de recompra', value: fmtPct(base.repurchasePct, 1), help: `% dos ${whoLower}s com 2+ compras (histórico completo).`, icon: <RefreshCw /> },
          { label: 'LTV médio', value: fmtCurrency0(base.avgLtvCents), help: `Receita total histórica por ${whoLower}, média entre quem tem ao menos uma compra.`, icon: <Wallet /> },
          {
            label: 'NPS',
            value: nps.responses > 0 ? String(nps.score) : '—',
            help: nps.responses > 0 ? 'NPS = %promotores − %detratores, sobre as respostas registradas.' : 'Nenhuma resposta de NPS registrada ainda. Dispare a pesquisa em Contatos ou crie uma automação com o gatilho "Cliente Convertido".',
            trend: nps.responses === 0 ? undefined : nps.score >= 50 ? 'up' : nps.score < 0 ? 'down' : 'neutral',
            trendLabel: nps.responses > 0 ? `${nps.responses} resposta(s)` : 'Sem respostas',
            icon: <Smile />,
          },
          { label: `${whoPlural} em risco`, value: String(base.segments.risco.count), help: `${whoPlural} sem compra há 90-179 dias (180+ dias viram "dormentes").`, trend: base.segments.risco.count > 0 ? 'down' : undefined, trendLabel: `${base.segments.dormente.count} dormente(s)`, icon: <AlertTriangle /> },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-8">
          <DashboardCard title="Evolução da base" help={`${whoPlural} que compraram em cada mês: novos (1ª compra), recorrentes e reativados (voltaram após 180+ dias).`} icon={LineChart} heightClass={MAIN_CARD_H}>
            {!hasBase ? (
              <EmptyChart text={`Nenhum ${whoLower} com compra registrada.`} />
            ) : (
              <MultiLineChart
                data={base.evolution.map(e => ({ label: e.label, novos: e.novos, recorrentes: e.recorrentes, reativados: e.reativados }))}
                series={[
                  { key: 'novos', name: 'Novos', color: '#1192e8' },
                  { key: 'recorrentes', name: 'Recorrentes', color: '#24a148' },
                  { key: 'reativados', name: 'Reativados', color: '#8a3ffc' },
                ]}
              />
            )}
          </DashboardCard>
        </div>
        <div className="md:col-span-4">
          <DashboardCard title="NPS" help="Distribuição das respostas de satisfação." icon={Smile} heightClass={MAIN_CARD_H}>
            {nps.responses === 0 ? (
              <EmptyChart text="Nenhuma resposta de NPS ainda." hint='Dispare a pesquisa em Contatos ou crie uma automação com o gatilho "Cliente Convertido".' />
            ) : (
              <NpsBreakdown nps={nps} />
            )}
          </DashboardCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <DashboardCard title="Segmentação da base" help="Distribuição dos clientes por comportamento de compra." icon={Layers} heightClass={COMPACT_CARD_H}>
            {!hasBase ? (
              <EmptyChart text={`Nenhum ${whoLower} com compra registrada.`} />
            ) : (
              <div className="h-full flex flex-col justify-center">
                <StackedShareBar
                  barHeight="h-12"
                  segments={SEGMENTS.map(s => ({ label: SEGMENT_LABEL[s], value: base.segments[s].count, valueLabel: String(base.segments[s].count), color: SEGMENT_COLOR[s] }))}
                />
              </div>
            )}
          </DashboardCard>
        </div>
        <div className="md:col-span-6">
          <BarListCard
            title="LTV por segmento"
            help="Receita histórica média por cliente em cada segmento."
            icon={Gem}
            color="#8a3ffc"
            rows={SEGMENTS.filter(s => base.segments[s].count > 0)
              .sort((a, b) => base.segments[b].avgLtvCents - base.segments[a].avgLtvCents)
              .map(s => ({ label: SEGMENT_LABEL[s], value: base.segments[s].avgLtvCents, valueLabel: fmtCurrency0(base.segments[s].avgLtvCents), sublabel: `${base.segments[s].count} cliente(s)`, color: SEGMENT_COLOR[s] }))}
            emptyText={`Nenhum ${whoLower} com compra registrada.`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-6">
          <DashboardCard title={`${whoPlural} VIP`} help="Top 10% de LTV entre os clientes ativos." icon={Crown} iconClassName="text-amber-500" heightClass={TABLE_CARD_H} scroll>
            <CustomerTable
              rows={base.vip}
              variant="vip"
              nameById={nameById}
              itemLabel={isClinic ? 'Último item' : 'Último destino/item'}
              countLabel="Compras"
              emptyText={`Nenhum ${whoLower} VIP ainda.`}
            />
          </DashboardCard>
        </div>
        <div className="md:col-span-6">
          <DashboardCard title={`${whoPlural} em risco`} help="Sem compra há 90-179 dias, por risco e LTV." icon={AlertTriangle} iconClassName="text-destructive" heightClass={TABLE_CARD_H} scroll>
            <CustomerTable
              rows={base.atRisk}
              variant="risk"
              nameById={nameById}
              itemLabel=""
              countLabel=""
              emptyText={`Nenhum ${whoLower} em risco agora.`}
            />
          </DashboardCard>
        </div>
      </div>

      <BarListCard
        title={`${whoPlural} por cidade`}
        help={`Top 10 cidades por nº de ${whoLower}s (sem geolocalização no cadastro — barras em vez de mapa). Valor ao lado = receita total.`}
        icon={MapPin}
        color="#0f62fe"
        rows={cities.map(c => ({ label: c.city, value: c.customers, valueLabel: `${c.customers} ${whoLower}(s)`, sublabel: fmtCurrencyCompact(c.revenue_cents) }))}
        emptyText={`Nenhum ${whoLower} com cidade cadastrada.`}
      />

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={ctx.orgSlug} tab="clientes" />
      </Suspense>
    </div>
  )
}
