'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Users,
  DollarSign,
  TrendingUp,
  Target,
  Megaphone,
  Plus,
  Upload,
  Settings,
  Receipt,
  ChevronDown,
  MousePointerClick,
  Eye,
  MessageCircle,
  TrendingDown,
  Link2,
  FileText,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts'
import NewAdAccountDialog from './NewAdAccountDialog'
import NewCampaignDialog from './NewCampaignDialog'
import RecordSpendDialog from './RecordSpendDialog'
import CampaignsTable from './CampaignsTable'
import MetricsChart from './MetricsChart'
import ImpressionsCpmChart from './ImpressionsCpmChart'
import ConversionByAdChart from './ConversionByAdChart'
import AdSpendCpmChart from './AdSpendCpmChart'
import MetricPicker from './MetricPicker'
import AccountFilter from './AccountFilter'
import type { ObjectiveGroup } from '@/lib/marketing/objective'
import { OBJECTIVE_GROUP_LABELS } from '@/lib/marketing/objective'
import { METRIC_REGISTRY, DEFAULT_CARD_METRICS, DEFAULT_CHART_METRICS, type MetricKey, type MetricContext } from './metricRegistry'
import { updateMarketingMetricsPrefs, syncAdAccountCampaigns } from '@/actions/marketing'

type CampaignRow = {
  id: string
  name: string
  color: string | null
  status: string
  objective_group: ObjectiveGroup
  ad_account_id: string
  provider: string
  account_name: string
  spend_cents: number
  impressions: number
  clicks: number
  leads: number
  cpl_cents: number | null
  cpm_cents: number | null
  ctr: number
  meta_leads: number
  meta_messaging_started: number
  meta_link_clicks: number
  meta_landing_page_views: number
  meta_purchases: number
  meta_purchase_value_cents: number
  cost_per_conversation_cents: number | null
  won_deals: number
  revenue_cents: number
  cac_cents: number | null
  roas: number | null
}

type TimeSeriesPoint = MetricContext & { date: string; ad_account_id: string; campaign_id: string }

type Overview = {
  totals: { spend_cents: number; impressions: number; clicks: number; leads: number; won_deals: number; revenue_cents: number }
  campaigns: CampaignRow[]
  timeSeries: TimeSeriesPoint[]
  sourcesByLeads: Array<{ name: string; value: number }>
  byObjective: Array<{ group: ObjectiveGroup; spend_cents: number; leads: number; meta_messaging_started: number; won_deals: number; revenue_cents: number }>
  previousCampaigns: Array<{ campaign_id: string; ad_account_id: string | null; objective_group: ObjectiveGroup; spend_cents: number; impressions: number; clicks: number; meta_leads: number; meta_messaging_started: number; meta_purchases: number }>
}

const OBJECTIVE_FILTERS: Array<{ value: ObjectiveGroup | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'leads', label: OBJECTIVE_GROUP_LABELS.leads },
  { value: 'messaging', label: OBJECTIVE_GROUP_LABELS.messaging },
  { value: 'traffic', label: OBJECTIVE_GROUP_LABELS.traffic },
  { value: 'sales', label: OBJECTIVE_GROUP_LABELS.sales },
  { value: 'awareness', label: OBJECTIVE_GROUP_LABELS.awareness },
]

type Account = { id: string; provider: string; name: string; status: string }
type Campaign = { id: string; name: string; ad_account_id: string; utm_campaign: string | null; color: string | null }

type Props = {
  orgSlug: string
  period: 'today' | '7d' | '30d' | '90d' | 'mtd' | 'max' | string
  overview: Overview
  accounts: Account[]
  campaigns: Campaign[]
  /** Nome do usuário Facebook logado (via login OAuth do Meta Ads) — null se
   *  nunca conectou ou o token expirou/foi revogado do lado da Meta. */
  metaLoginUserName?: string | null
  /** Preferências de cards/gráfico salvas anteriormente (org_settings) — null
   *  na primeira vez, cai nos defaults (DEFAULT_CARD_METRICS/DEFAULT_CHART_METRICS). */
  initialMetricsPrefs?: { cardMetrics: string[]; chartMetrics: string[] } | null
}

const PERIODS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'mtd', label: 'Mês atual' },
  { value: 'max', label: 'Máximo' },
] as const

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/** Um número atual x anterior, com % de variação — sem julgar se subir é bom
 *  ou ruim (depende da métrica: investimento subir não é "ruim"), só mostra
 *  a direção e o tamanho da mudança. */
function ComparisonStat({
  label, current, previous, format,
}: {
  label: string
  current: number
  previous: number
  format: (v: number) => string
}) {
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : null
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums">{format(current)}</p>
      {delta != null ? (
        <p className={cn('text-xs tabular-nums flex items-center gap-1', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          <span className="text-muted-foreground">vs {format(previous)}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Sem dado anterior</p>
      )}
    </div>
  )
}

/** 'menu' = linha dentro de um DropdownMenu — precisa parecer um item de
 *  menu (mesmo hover/alinhamento dos DropdownMenuItem simples ao lado),
 *  não um botão avulso. Sem isso os itens do menu "Gerenciar contas"
 *  ficavam com estilos inconsistentes entre si. */
type TriggerVariant = 'default' | 'outline' | 'menu'

function triggerButtonProps(variant: TriggerVariant) {
  if (variant === 'menu') {
    return { variant: 'ghost' as const, className: 'w-full h-auto justify-start px-2 py-1.5 font-normal' }
  }
  return { variant, size: variant === 'outline' ? ('sm' as const) : undefined }
}

const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const METRIC_ICONS: Record<MetricKey, any> = {
  spend: Receipt,
  impressions: Eye,
  clicks: MousePointerClick,
  leads: Users,
  cpl: DollarSign,
  ctr: Target,
  cpc: DollarSign,
  cpm: Eye,
  meta_leads: Users,
  meta_messaging_started: MessageCircle,
  meta_link_clicks: Link2,
  meta_landing_page_views: FileText,
  meta_purchases: ShoppingCart,
  cac: Target,
  roas: TrendingUp,
  cost_per_conversion: MessageCircle,
}

const METRIC_ICON_BG: Record<MetricKey, string> = {
  spend: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  impressions: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  clicks: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  leads: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  cpl: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  ctr: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  cpc: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  cpm: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  meta_leads: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  meta_messaging_started: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  meta_link_clicks: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  meta_landing_page_views: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  meta_purchases: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  cac: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  roas: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  cost_per_conversion: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
}

function PeriodTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams?.get('period') || '30d'

  function set(value: string) {
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('period', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={current} onValueChange={set}>
      <TabsList className="bg-secondary rounded-full p-1 h-auto gap-0.5">
        {PERIODS.map(p => (
          <TabsTrigger
            key={p.value}
            value={p.value}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium data-[state=active]:bg-background  "
          >
            {p.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function KPICard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconBg,
}: {
  label: string
  value: string
  sublabel?: string
  icon: any
  iconBg?: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg || 'bg-muted text-muted-foreground'}`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5 truncate">{value}</p>
            {sublabel && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sublabel}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Filtra pra só as chaves que ainda existem no registro atual — evita
 *  quebrar se uma preferência salva referenciar uma métrica removida. */
function sanitizeMetricKeys(keys: string[] | undefined, fallback: MetricKey[]): Set<MetricKey> {
  if (!keys || keys.length === 0) return new Set(fallback)
  const valid = keys.filter((k): k is MetricKey => k in METRIC_REGISTRY)
  return valid.length > 0 ? new Set(valid) : new Set(fallback)
}

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
          telas com muito conteúdo. */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-3 -mt-3 pb-3 bg-background space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodTabs />
          {/* Badge 1: identidade do login do Facebook — "com qual conta da
              Meta o CRM está conectado", separado de qual conta de anúncio
              está sendo exibida agora (badge 2, o AccountFilter abaixo). */}
          {metaLoginUserName && (
            <button
              type="button"
              title="Ver/gerenciar login e contas conectadas"
              onClick={() => router.push(`/app/${orgSlug}/marketing/contas`)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              Conectado como <span className="font-medium text-foreground">{metaLoginUserName}</span>
            </button>
          )}
          {/* Badge 2: qual conta de anúncio está em exibição agora (só 1 por vez). */}
          <AccountFilter
            accounts={accounts}
            selected={accountFilter}
            onChange={setAccountFilter}
          />
          <MetricPicker
            visibleCardMetrics={visibleCardMetrics}
            onChangeCardMetrics={setVisibleCardMetrics}
            visibleChartMetrics={visibleChartMetrics}
            onChangeChartMetrics={setVisibleChartMetrics}
          />
          {accountFilter && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={syncing}
              onClick={resyncAccount}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', syncing && 'animate-spin')} /> Resincronizar
            </Button>
          )}
        </div>

        {/* Sem conta nenhuma, o banner abaixo já cobre o CTA de conectar —
            não duplica o botão aqui. Com conta conectada, vira "Gerenciar
            contas" (é mais que só "novo": inclui conectar mais contas,
            importar CSV etc.). */}
        {!noAccountsYet && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Settings className="w-4 h-4 mr-1.5" /> Gerenciar contas
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <NewCampaignTrigger orgSlug={orgSlug} accounts={accounts} onDone={refresh} variant="menu" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <RecordSpendTrigger
                  orgSlug={orgSlug}
                  campaigns={campaigns}
                  onDone={refresh}
                  variant="menu"
                />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NewAccountTrigger orgSlug={orgSlug} onDone={refresh} variant="menu" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/app/${orgSlug}/marketing/importar`)}>
                <Upload className="w-4 h-4 mr-2" /> Importar CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/app/${orgSlug}/marketing/contas`)}
              >
                <Settings className="w-4 h-4 mr-2" /> Ver todas as contas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      </div>

      {/* Setup banner if no accounts/campaigns yet */}
      {(noAccountsYet || noCampaignsYet) && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold mb-1">Comece em 2 passos</p>
              <p className="text-sm text-muted-foreground mb-3">
                {noAccountsYet
                  ? '1. Conecte sua conta de anúncio (Meta, Google). 2. Escolha quais contas sincronizar — os dados aparecem aqui automaticamente, sem passo manual extra.'
                  : '1. Cadastre uma campanha vinculada à conta. 2. Lance gastos diários ou importe um CSV exportado do Meta/Google.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {noAccountsYet && <NewAccountTrigger orgSlug={orgSlug} onDone={refresh} variant="default" />}
                {!noAccountsYet && noCampaignsYet && (
                  <NewCampaignTrigger orgSlug={orgSlug} accounts={accounts} onDone={refresh} variant="default" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs/gráficos/tabela só fazem sentido com conta conectada e
          campanha cadastrada — antes disso é só ruído visual (tudo "—" e
          gráfico vazio), então nem renderiza. */}
      {!noAccountsYet && !noCampaignsYet && (
        <>
          {/* Filtro por objetivo — mostra a métrica de conversão certa por tipo de campanha */}
          <Tabs value={objectiveFilter} onValueChange={v => setObjectiveFilter(v as ObjectiveGroup | 'all')}>
            <TabsList className="bg-secondary rounded-full p-1 h-auto gap-0.5 flex-wrap">
              {OBJECTIVE_FILTERS.map(f => (
                <TabsTrigger
                  key={f.value}
                  value={f.value}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium data-[state=active]:bg-background"
                >
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Investimento por objetivo</CardTitle>
              </CardHeader>
              <CardContent>
                {byObjectiveData.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                    Sem investimento registrado no período.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={byObjectiveData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {byObjectiveData.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip formatter={(v: any) => [fmtCurrency(Number(v) || 0), 'Investimento']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                      {byObjectiveData.map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                            />
                            <span className="truncate">{s.name}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">{fmtCurrency(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Comparação com o período anterior</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Mesma duração do período selecionado, imediatamente anterior a ele.
                </p>
              </CardHeader>
              <CardContent>
                {!hasPreviousData ? (
                  <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                    Sem dados suficientes no período anterior pra comparar (considerando a conta/objetivo selecionados).
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <ComparisonStat
                      label="Investimento"
                      current={filteredTotals.spend_cents}
                      previous={previousFilteredTotals.spend_cents}
                      format={fmtCurrency}
                    />
                    <ComparisonStat
                      label="Impressões"
                      current={filteredTotals.impressions}
                      previous={previousFilteredTotals.impressions}
                      format={fmtNumber}
                    />
                    <ComparisonStat
                      label="Cliques"
                      current={filteredTotals.clicks}
                      previous={previousFilteredTotals.clicks}
                      format={fmtNumber}
                    />
                    <ComparisonStat
                      label="CPC médio"
                      current={filteredTotals.clicks > 0 ? Math.round(filteredTotals.spend_cents / filteredTotals.clicks) : 0}
                      previous={previousFilteredTotals.clicks > 0 ? Math.round(previousFilteredTotals.spend_cents / previousFilteredTotals.clicks) : 0}
                      format={fmtCurrency}
                    />
                    {(() => {
                      // Conversões = conversas iniciadas + leads + compras da
                      // Meta — mesmo conceito agregado usado em
                      // metricRegistry.cost_per_conversion, só que aqui
                      // comparando atual vs. período anterior.
                      const curConversions = filteredTotals.meta_messaging_started + filteredTotals.meta_leads + filteredTotals.meta_purchases
                      const prevConversions = previousFilteredTotals.meta_messaging_started + previousFilteredTotals.meta_leads + previousFilteredTotals.meta_purchases
                      return (
                        <>
                          <ComparisonStat
                            label="Conversões"
                            current={curConversions}
                            previous={prevConversions}
                            format={fmtNumber}
                          />
                          <ComparisonStat
                            label="Custo por conversa"
                            current={filteredTotals.meta_messaging_started > 0 ? Math.round(filteredTotals.spend_cents / filteredTotals.meta_messaging_started) : 0}
                            previous={previousFilteredTotals.meta_messaging_started > 0 ? Math.round(previousFilteredTotals.spend_cents / previousFilteredTotals.meta_messaging_started) : 0}
                            format={fmtCurrency}
                          />
                          <ComparisonStat
                            label="CPM"
                            current={filteredTotals.impressions > 0 ? Math.round((filteredTotals.spend_cents / filteredTotals.impressions) * 1000) : 0}
                            previous={previousFilteredTotals.impressions > 0 ? Math.round((previousFilteredTotals.spend_cents / previousFilteredTotals.impressions) * 1000) : 0}
                            format={fmtCurrency}
                          />
                          <ComparisonStat
                            label="Custo por conversão"
                            current={curConversions > 0 ? Math.round(filteredTotals.spend_cents / curConversions) : 0}
                            previous={prevConversions > 0 ? Math.round(previousFilteredTotals.spend_cents / prevConversions) : 0}
                            format={fmtCurrency}
                          />
                        </>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
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

/* -------- Trigger wrappers (open dialogs from dropdown items) -------- */

function NewAccountTrigger({
  orgSlug,
  onDone,
  variant = 'outline',
  label = 'Nova conta de anúncio',
}: {
  orgSlug: string
  onDone: () => void
  variant?: TriggerVariant
  label?: string
}) {
  return (
    <NewAdAccountDialog
      orgSlug={orgSlug}
      onDone={onDone}
      trigger={
        <Button {...triggerButtonProps(variant)}>
          <Settings className="w-4 h-4 mr-2" /> {label}
        </Button>
      }
    />
  )
}

function NewCampaignTrigger({
  orgSlug,
  accounts,
  onDone,
  variant = 'outline',
}: {
  orgSlug: string
  accounts: Account[]
  onDone: () => void
  variant?: TriggerVariant
}) {
  return (
    <NewCampaignDialog
      orgSlug={orgSlug}
      accounts={accounts}
      onDone={onDone}
      trigger={
        <Button {...triggerButtonProps(variant)}>
          <Megaphone className="w-4 h-4 mr-2" /> Nova campanha
        </Button>
      }
    />
  )
}

function RecordSpendTrigger({
  orgSlug,
  campaigns,
  onDone,
  variant = 'outline',
}: {
  orgSlug: string
  campaigns: Campaign[]
  onDone: () => void
  variant?: TriggerVariant
}) {
  return (
    <RecordSpendDialog
      orgSlug={orgSlug}
      campaigns={campaigns}
      onDone={onDone}
      trigger={
        <Button {...triggerButtonProps(variant)}>
          <Receipt className="w-4 h-4 mr-2" /> Lançar gasto diário
        </Button>
      }
    />
  )
}
