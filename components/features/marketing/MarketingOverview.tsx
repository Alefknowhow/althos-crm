'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
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

type CampaignRow = {
  id: string
  name: string
  color: string | null
  status: string
  provider: string
  account_name: string
  spend_cents: number
  impressions: number
  clicks: number
  leads: number
  cpl_cents: number | null
  ctr: number
}

type Overview = {
  totals: { spend_cents: number; impressions: number; clicks: number; leads: number }
  campaigns: CampaignRow[]
  timeSeries: Array<{
    date: string
    spend_cents: number
    impressions: number
    clicks: number
    leads: number
  }>
  sourcesByLeads: Array<{ name: string; value: number }>
}

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
  trend,
  iconBg,
}: {
  label: string
  value: string
  sublabel?: string
  icon: any
  trend?: { value: number; positive?: boolean }
  iconBg?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg || 'bg-muted text-muted-foreground'}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
            {trend && (
              <p
                className={`text-xs mt-1 inline-flex items-center gap-1 ${
                  trend.positive === false ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {trend.positive === false ? (
                  <ArrowDownRight className="w-3 h-3" />
                ) : (
                  <ArrowUpRight className="w-3 h-3" />
                )}
                {Math.abs(trend.value).toFixed(1)}% vs. período anterior
              </p>
            )}
            {sublabel && !trend && (
              <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MarketingOverview({ orgSlug, overview, accounts, campaigns }: Props) {
  const [, startTransition] = useTransition()
  const router = useRouter()

  const totalSpend = overview.totals.spend_cents
  const totalLeads = overview.totals.leads
  const totalClicks = overview.totals.clicks
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0
  const ctr = overview.totals.impressions > 0
    ? (totalClicks / overview.totals.impressions) * 100
    : 0
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0

  const hasData =
    overview.campaigns.length > 0 || overview.timeSeries.length > 0 || overview.totals.spend_cents > 0

  const noAccountsYet = accounts.length === 0
  const noCampaignsYet = campaigns.length === 0

  function refresh() {
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Marketing
            <Sparkles className="w-4 h-4 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o desempenho das suas campanhas e atraia mais clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodTabs />

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

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          label="Novos Leads"
          value={fmtNumber(totalLeads)}
          icon={Users}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <KPICard
          label="Custo por Lead"
          value={cpl > 0 ? fmtCurrency(cpl) : '—'}
          icon={DollarSign}
          iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <KPICard
          label="Investimento Total"
          value={fmtCurrency(totalSpend)}
          icon={Receipt}
          iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <KPICard
          label="Impressões"
          value={fmtNumber(overview.totals.impressions)}
          icon={TrendingUp}
          iconBg="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
        <KPICard
          label="Cliques"
          value={fmtNumber(totalClicks)}
          sublabel={`CTR: ${ctr.toFixed(2)}%`}
          icon={Target}
          iconBg="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
        />
        <KPICard
          label="CPC médio"
          value={cpc > 0 ? fmtCurrency(cpc) : '—'}
          icon={DollarSign}
          iconBg="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Multi-metric chart with toggleable series */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Evolução das métricas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Clique nos chips abaixo para mostrar/ocultar cada métrica.
            </p>
          </CardHeader>
          <CardContent>
            <MetricsChart data={overview.timeSeries} />
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
        rows={overview.campaigns}
        onRefresh={refresh}
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
