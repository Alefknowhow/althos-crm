'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
  Link2,
  FileText,
  ShoppingCart,
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
import MetricPicker from './MetricPicker'
import AccountFilter from './AccountFilter'
import type { ObjectiveGroup } from '@/lib/marketing/objective'
import { OBJECTIVE_GROUP_LABELS } from '@/lib/marketing/objective'
import { METRIC_REGISTRY, DEFAULT_CARD_METRICS, DEFAULT_CHART_METRICS, type MetricKey, type MetricContext } from './metricRegistry'

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
  period: 'today' | '7d' | '30d' | '90d' | 'mtd' | string
  overview: Overview
  accounts: Account[]
  campaigns: Campaign[]
}

const PERIODS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'mtd', label: 'Mês atual' },
] as const

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
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
  meta_leads: Users,
  meta_messaging_started: MessageCircle,
  meta_link_clicks: Link2,
  meta_landing_page_views: FileText,
  meta_purchases: ShoppingCart,
  cac: Target,
  roas: TrendingUp,
}

const METRIC_ICON_BG: Record<MetricKey, string> = {
  spend: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  impressions: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  clicks: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  leads: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  cpl: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  ctr: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  cpc: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  meta_leads: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  meta_messaging_started: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  meta_link_clicks: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  meta_landing_page_views: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  meta_purchases: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  cac: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  roas: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
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

export default function MarketingOverview({ orgSlug, overview, accounts, campaigns, period }: Props) {
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [objectiveFilter, setObjectiveFilter] = useState<ObjectiveGroup | 'all'>('all')
  const [accountFilter, setAccountFilter] = useState<Set<string> | 'all'>('all')
  // Quais campanhas entram no gráfico — checkbox por linha na tabela.
  // 'all' = todas (default); um Set explícito = só as marcadas.
  const [chartCampaignFilter, setChartCampaignFilter] = useState<Set<string> | 'all'>('all')
  const [visibleCardMetrics, setVisibleCardMetrics] = useState<Set<MetricKey>>(new Set(DEFAULT_CARD_METRICS))
  const [visibleChartMetrics, setVisibleChartMetrics] = useState<Set<MetricKey>>(new Set(DEFAULT_CHART_METRICS))

  const filteredCampaigns = overview.campaigns
    .filter(c => objectiveFilter === 'all' || c.objective_group === objectiveFilter)
    .filter(c => accountFilter === 'all' || accountFilter.has(c.ad_account_id))

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
      if (accountFilter !== 'all' && !accountFilter.has(p.ad_account_id)) continue
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

  const hasData =
    overview.campaigns.length > 0 || overview.timeSeries.length > 0 || overview.totals.spend_cents > 0

  const noAccountsYet = accounts.length === 0
  const noCampaignsYet = campaigns.length === 0

  function refresh() {
    startTransition(() => router.refresh())
  }

  const cardMetricKeys = (Object.keys(METRIC_REGISTRY) as MetricKey[]).filter(k => visibleCardMetrics.has(k))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodTabs />
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
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1.5" /> Novo
              <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <NewCampaignTrigger orgSlug={orgSlug} accounts={accounts} onDone={refresh} />
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <RecordSpendTrigger
                orgSlug={orgSlug}
                campaigns={campaigns}
                onDone={refresh}
              />
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <NewAccountTrigger orgSlug={orgSlug} onDone={refresh} />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/app/${orgSlug}/marketing/importar`)}>
              <Upload className="w-4 h-4 mr-2" /> Importar CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/app/${orgSlug}/marketing/contas`)}
            >
              <Settings className="w-4 h-4 mr-2" /> Gerenciar contas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  ? '1. Crie uma conta de anúncio (Meta, Google). 2. Cadastre suas campanhas e lance gastos diários ou importe um CSV.'
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
              Use "Personalizar" acima pra escolher quais métricas aparecem aqui.
            </p>
          </CardHeader>
          <CardContent>
            <MetricsChart data={filteredTimeSeries} visible={visibleChartMetrics} />
          </CardContent>
        </Card>

        {/* Sources by leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por campanha</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.sourcesByLeads.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                Atribuição ainda sem dados. Configure o <strong>utm_campaign</strong> nas suas
                campanhas para conectar.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={overview.sourcesByLeads}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {overview.sourcesByLeads.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {overview.sourcesByLeads.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                        />
                        <span className="truncate">{s.name}</span>
                      </div>
                      <span className="tabular-nums text-muted-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
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

      {!hasData && !noAccountsYet && !noCampaignsYet && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Cadastre métricas de gasto diário (manual ou via CSV) para ver os KPIs e gráficos
            populados.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* -------- Trigger wrappers (open dialogs from dropdown items) -------- */

function NewAccountTrigger({
  orgSlug,
  onDone,
  variant = 'outline',
}: {
  orgSlug: string
  onDone: () => void
  variant?: 'default' | 'outline'
}) {
  return (
    <NewAdAccountDialog
      orgSlug={orgSlug}
      onDone={onDone}
      trigger={
        <Button variant={variant} size={variant === 'outline' ? 'sm' : undefined}>
          <Settings className="w-4 h-4 mr-2" /> Nova conta de anúncio
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
  variant?: 'default' | 'outline'
}) {
  return (
    <NewCampaignDialog
      orgSlug={orgSlug}
      accounts={accounts}
      onDone={onDone}
      trigger={
        <Button variant={variant} size={variant === 'outline' ? 'sm' : undefined}>
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
}: {
  orgSlug: string
  campaigns: Campaign[]
  onDone: () => void
}) {
  return (
    <RecordSpendDialog
      orgSlug={orgSlug}
      campaigns={campaigns}
      onDone={onDone}
      trigger={
        <Button variant="outline" size="sm">
          <Receipt className="w-4 h-4 mr-2" /> Lançar gasto diário
        </Button>
      }
    />
  )
}
