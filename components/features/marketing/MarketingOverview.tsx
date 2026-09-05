'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CampaignsTable from './CampaignsTable'
import MetricsChart from './MetricsChart'
import ImpressionsCpmChart from './ImpressionsCpmChart'
import ConversionByAdChart from './ConversionByAdChart'
import AdSpendCpmChart from './AdSpendCpmChart'
import type { ObjectiveGroup } from '@/lib/marketing/objective'
import { OBJECTIVE_GROUP_LABELS } from '@/lib/marketing/objective'
import { METRIC_REGISTRY, DEFAULT_CARD_METRICS, DEFAULT_CHART_METRICS, type MetricKey, type MetricContext } from './metricRegistry'
import { updateMarketingMetricsPrefs, syncAdAccountCampaigns } from '@/actions/marketing'
import {
  fmtNumber,
  METRIC_ICONS,
  METRIC_ICON_BG,
  sanitizeMetricKeys,
  type Props,
} from './MarketingOverviewShared'
import { KPICard } from './MarketingOverviewControls'
import MarketingOverviewObjectiveChart from './MarketingOverviewObjectiveChart'
import MarketingOverviewComparison from './MarketingOverviewComparison'
import MarketingOverviewHeader from './MarketingOverviewHeader'
import MarketingOverviewSetupBanner from './MarketingOverviewSetupBanner'

export default function MarketingOverview({ orgSlug, overview, accounts, campaigns, period, metaLoginUserName, initialMetricsPrefs }: Props) {
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [objectiveFilter, setObjectiveFilter] = useState<ObjectiveGroup | 'all'>('all')
  // Só 1 conta por vez nos gráficos/tabela — misturar métricas de contas
  // diferentes na mesma série confundia mais do que ajudava. Começa com a
  // primeira conta da lista.
  const [accountFilter, setAccountFilter] = useState<string | null>(accounts[0]?.id ?? null)
  // Quais campanhas entram no gráfico — checkbox por linha na tabela.
  // 'all' = todas (default); um Set explícito = só as marcadas.
  const [chartCampaignFilter, setChartCampaignFilter] = useState<Set<string> | 'all'>('all')
  // Cards/gráfico visíveis — carrega da preferência salva em org_settings
  // (getMarketingMetricsPrefs, buscada no page.tsx); sem isso, cai nos
  // defaults. Toda mudança aqui persiste de volta (ver handleChange* abaixo).
  const [visibleCardMetrics, setVisibleCardMetricsState] = useState<Set<MetricKey>>(
    () => sanitizeMetricKeys(initialMetricsPrefs?.cardMetrics, DEFAULT_CARD_METRICS),
  )
  const [visibleChartMetrics, setVisibleChartMetricsState] = useState<Set<MetricKey>>(
    () => sanitizeMetricKeys(initialMetricsPrefs?.chartMetrics, DEFAULT_CHART_METRICS),
  )

  function persistMetricsPrefs(cardMetrics: Set<MetricKey>, chartMetrics: Set<MetricKey>) {
    updateMarketingMetricsPrefs(orgSlug, {
      cardMetrics: Array.from(cardMetrics),
      chartMetrics: Array.from(chartMetrics),
    }).catch(() => {})
  }

  function setVisibleCardMetrics(next: Set<MetricKey>) {
    setVisibleCardMetricsState(next)
    persistMetricsPrefs(next, visibleChartMetrics)
  }

  function setVisibleChartMetrics(next: Set<MetricKey>) {
    setVisibleChartMetricsState(next)
    persistMetricsPrefs(visibleCardMetrics, next)
  }

  const filteredCampaigns = overview.campaigns
    .filter(c => objectiveFilter === 'all' || c.objective_group === objectiveFilter)
    .filter(c => !accountFilter || c.ad_account_id === accountFilter)

  const filteredTotals: MetricContext = filteredCampaigns.reduce(
    (acc, c) => {
      acc.spend_cents += c.spend_cents
      acc.impressions += c.impressions
      acc.clicks += c.clicks
      acc.leads += c.leads
      acc.meta_leads += c.meta_leads
      acc.meta_messaging_started += c.meta_messaging_started
      acc.meta_link_clicks += c.meta_link_clicks
      acc.meta_landing_page_views += c.meta_landing_page_views
      acc.meta_purchases += c.meta_purchases
      acc.meta_purchase_value_cents += c.meta_purchase_value_cents
      acc.won_deals += c.won_deals
      acc.revenue_cents += c.revenue_cents
      return acc
    },
    { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0, won_deals: 0, revenue_cents: 0 },
  )

  // Série diária filtrada pela conta e pelas campanhas marcadas na tabela
  // (o objetivo não afeta o gráfico — não dá pra reagregar por objetivo
  // sem reprocessar por campanha/dia, fora de escopo).
  const filteredTimeSeries = useMemo(() => {
    const byDate = new Map<string, MetricContext & { date: string }>()
    for (const p of overview.timeSeries) {
      if (accountFilter && p.ad_account_id !== accountFilter) continue
      if (chartCampaignFilter !== 'all' && !chartCampaignFilter.has(p.campaign_id)) continue
      const cur = byDate.get(p.date) || {
        date: p.date, spend_cents: 0, impressions: 0, clicks: 0, leads: 0,
        meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0,
        won_deals: 0, revenue_cents: 0,
      }
      cur.spend_cents += p.spend_cents
      cur.impressions += p.impressions
      cur.clicks += p.clicks
      cur.leads += p.leads
      cur.meta_leads += p.meta_leads
      cur.meta_messaging_started += p.meta_messaging_started
      cur.meta_link_clicks += p.meta_link_clicks
      cur.meta_landing_page_views += p.meta_landing_page_views
      cur.meta_purchases += p.meta_purchases
      cur.meta_purchase_value_cents += p.meta_purchase_value_cents
      byDate.set(p.date, cur)
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [overview.timeSeries, accountFilter, chartCampaignFilter])

  // Investimento por objetivo (Leads/Mensagens/Tráfego/Vendas/Reconhecimento)
  // — calculado a partir das campanhas já filtradas por conta/objetivo,
  // pra bater com o resto do painel (não usa overview.byObjective, que é
  // agregado sem filtro de conta).
  const byObjectiveData = useMemo(() => {
    const byGroup = new Map<string, number>()
    for (const c of filteredCampaigns) {
      byGroup.set(c.objective_group, (byGroup.get(c.objective_group) || 0) + c.spend_cents)
    }
    return Array.from(byGroup.entries())
      .map(([group, cents]) => ({ name: OBJECTIVE_GROUP_LABELS[group as ObjectiveGroup] || group, value: cents }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [filteredCampaigns])

  // Totais do período anterior, filtrados pela MESMA conta/objetivo que
  // filteredTotals — sem isso a comparação misturava contas/objetivos que
  // nem estão selecionados na tela, e o número não batia com nada visível.
  const { previousFilteredTotals, hasPreviousData } = useMemo(() => {
    const matching = overview.previousCampaigns
      .filter(c => objectiveFilter === 'all' || c.objective_group === objectiveFilter)
      .filter(c => !accountFilter || c.ad_account_id === accountFilter)
    const totals = matching.reduce(
      (acc, c) => {
        acc.spend_cents += c.spend_cents
        acc.impressions += c.impressions
        acc.clicks += c.clicks
        acc.meta_leads += c.meta_leads
        acc.meta_messaging_started += c.meta_messaging_started
        acc.meta_purchases += c.meta_purchases
        return acc
      },
      { spend_cents: 0, impressions: 0, clicks: 0, meta_leads: 0, meta_messaging_started: 0, meta_purchases: 0 },
    )
    return { previousFilteredTotals: totals, hasPreviousData: matching.length > 0 }
  }, [overview.previousCampaigns, objectiveFilter, accountFilter])

  const hasData =
    overview.campaigns.length > 0 || overview.timeSeries.length > 0 || overview.totals.spend_cents > 0

  const noAccountsYet = accounts.length === 0
  const noCampaignsYet = campaigns.length === 0

  function refresh() {
    startTransition(() => router.refresh())
  }

  const [syncing, setSyncing] = useState(false)

  async function resyncAccount() {
    if (!accountFilter) return
    setSyncing(true)
    const res = await syncAdAccountCampaigns(orgSlug, accountFilter, period as any)
    setSyncing(false)
    if (!res.ok) { toast.error(res.error); return }
    if (res.error) toast.warning(`Sincronizado com avisos: ${res.error}`)
    else toast.success(`${res.campaignsSynced} campanha(s), ${res.metricsSynced} métrica(s) atualizadas`)
    refresh()
  }

  const cardMetricKeys = (Object.keys(METRIC_REGISTRY) as MetricKey[]).filter(k => visibleCardMetrics.has(k))

  return (
    <div className="space-y-6">
      {/* Painel superior fixo (filtros/período/contas) — só a área de
          cards/gráficos abaixo rola, pra manter os filtros sempre à mão em
          telas com muito conteúdo. <main> não tem mais pt-* (removido
          globalmente em app/[orgSlug]/layout.tsx), então esse painel já
          nasce colado — sem margin-top negativo nem pt-* próprio (ver
          .harness/agents/ux.md). */}
      <MarketingOverviewHeader
        orgSlug={orgSlug}
        accounts={accounts}
        campaigns={campaigns}
        metaLoginUserName={metaLoginUserName}
        accountFilter={accountFilter}
        setAccountFilter={setAccountFilter}
        visibleCardMetrics={visibleCardMetrics}
        onChangeCardMetrics={setVisibleCardMetrics}
        visibleChartMetrics={visibleChartMetrics}
        onChangeChartMetrics={setVisibleChartMetrics}
        syncing={syncing}
        onResyncAccount={resyncAccount}
        noAccountsYet={noAccountsYet}
        noCampaignsYet={noCampaignsYet}
        objectiveFilter={objectiveFilter}
        setObjectiveFilter={setObjectiveFilter}
        onRefresh={refresh}
      />

      {/* Setup banner if no accounts/campaigns yet */}
      {(noAccountsYet || noCampaignsYet) && (
        <MarketingOverviewSetupBanner
          orgSlug={orgSlug}
          accounts={accounts}
          noAccountsYet={noAccountsYet}
          noCampaignsYet={noCampaignsYet}
          onDone={refresh}
        />
      )}

      {/* KPIs/gráficos/tabela só fazem sentido com conta conectada e
          campanha cadastrada — antes disso é só ruído visual (tudo "—" e
          gráfico vazio), então nem renderiza. */}
      {!noAccountsYet && !noCampaignsYet && (
        <>
          {/* KPI cards — dinâmicos, controlados pelo MetricPicker. Número exato
              de colunas (não auto-fit) pra nunca quebrar linha, mesmo com o
              cap de 8 métricas simultâneas. */}
          <div
            className="grid gap-2 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${cardMetricKeys.length}, minmax(120px, 1fr))` }}
          >
            {cardMetricKeys.map(k => {
              const def = METRIC_REGISTRY[k]
              const raw = def.extract(filteredTotals)
              const value = raw > 0 ? def.format(raw) : '—'
              const sublabel =
                k === 'clicks' ? `CTR: ${METRIC_REGISTRY.ctr.extract(filteredTotals).toFixed(2)}%`
                : k === 'cac' ? `${fmtNumber(filteredTotals.won_deals)} negócio(s) ganho(s)`
                : undefined
              return (
                <KPICard
                  key={k}
                  label={def.label}
                  value={value}
                  sublabel={sublabel}
                  icon={METRIC_ICONS[k]}
                  iconBg={METRIC_ICON_BG[k]}
                />
              )
            })}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Multi-metric chart — visibilidade controlada pelo MetricPicker */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Evolução das métricas</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Use &quot;Personalizar&quot; acima pra escolher quais métricas aparecem aqui.
                </p>
              </CardHeader>
              <CardContent>
                <MetricsChart data={filteredTimeSeries} visible={visibleChartMetrics} />
              </CardContent>
            </Card>

            {/* Custo por anúncio — substitui "Leads por campanha": mais
                acionável pra quem gerencia a verba (onde o dinheiro está
                indo e a que custo, anúncio a anúncio). */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custo por anúncio</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Valor investido, CPM e valor por conversão de cada anúncio.
                </p>
              </CardHeader>
              <CardContent>
                <AdSpendCpmChart orgSlug={orgSlug} adAccountId={accountFilter} period={period} />
              </CardContent>
            </Card>
          </div>

          {/* Charts row 2 — impressões/CPM e conversão por anúncio */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Impressões e CPM</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Volume de impressões (barras) x custo por mil impressões (linha), dia a dia.
                </p>
              </CardHeader>
              <CardContent>
                <ImpressionsCpmChart data={filteredTimeSeries} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversão por anúncio</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Ranking dos anúncios individuais — conversões, cliques e impressões numa única barra.
                </p>
              </CardHeader>
              <CardContent>
                <ConversionByAdChart orgSlug={orgSlug} adAccountId={accountFilter} period={period} />
              </CardContent>
            </Card>
          </div>

          {/* Charts row 3 — investimento por objetivo e comparação com período anterior */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MarketingOverviewObjectiveChart byObjectiveData={byObjectiveData} />
            <MarketingOverviewComparison
              filteredTotals={filteredTotals}
              previousFilteredTotals={previousFilteredTotals}
              hasPreviousData={hasPreviousData}
            />
          </div>

          {/* Campaigns table */}
          <CampaignsTable
            orgSlug={orgSlug}
            rows={filteredCampaigns}
            period={period}
            onRefresh={refresh}
            chartSelection={chartCampaignFilter}
            onToggleChartSelection={id => {
              setChartCampaignFilter(prev => {
                const base = prev === 'all' ? new Set(overview.campaigns.map(c => c.id)) : new Set(prev)
                if (base.has(id)) base.delete(id)
                else base.add(id)
                return base.size === overview.campaigns.length ? 'all' : base
              })
            }}
          />

          {!hasData && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Cadastre métricas de gasto diário (manual ou via CSV) para ver os KPIs e gráficos
                populados.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
