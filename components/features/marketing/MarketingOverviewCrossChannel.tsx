'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { DollarSign, Users, MousePointerClick, Target, TrendingUp, Receipt } from 'lucide-react'
import { KPICard, PeriodTabs } from './MarketingOverviewControls'
import MetricsChart from './MetricsChart'
import MarketingOverviewSetupBanner from './MarketingOverviewSetupBanner'
import { NewAccountTrigger } from './MarketingOverviewTriggers'
import { useMarketingOverviewMetrics } from './useMarketingOverviewMetrics'
import type { MetricKey } from './metricRegistry'
import { fmtCurrency, fmtNumber, type Account, type Overview, type CampaignRow } from './MarketingOverviewShared'

const OVERVIEW_CHART_METRICS: Set<MetricKey> = new Set<MetricKey>(['spend', 'leads'])

const PROVIDER_LABELS: Record<string, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
  other: 'Outro',
}

/** Rota da aba de detalhe de cada provider — só Meta/Google têm aba própria
 *  hoje (issue #24); outros providers ficam sem link de detalhe (nenhum
 *  modelo genérico o suficiente pra apontar com segurança). */
const PROVIDER_TAB_SEGMENT: Record<string, string> = {
  meta: 'meta-ads',
  google: 'google-ads',
}

type AccountSummary = {
  ad_account_id: string
  provider: string
  account_name: string
  spend_cents: number
  leads: number
  won_deals: number
  revenue_cents: number
}

function summarizeByAccount(campaigns: CampaignRow[]): AccountSummary[] {
  const map = new Map<string, AccountSummary>()
  for (const c of campaigns) {
    const cur = map.get(c.ad_account_id) ?? {
      ad_account_id: c.ad_account_id,
      provider: c.provider,
      account_name: c.account_name,
      spend_cents: 0,
      leads: 0,
      won_deals: 0,
      revenue_cents: 0,
    }
    cur.spend_cents += c.spend_cents
    cur.leads += c.leads
    cur.won_deals += c.won_deals
    cur.revenue_cents += c.revenue_cents
    map.set(c.ad_account_id, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.spend_cents - a.spend_cents)
}

/** CPL quando há lead atribuído; senão CPA (custo por venda) quando há
 *  negócio ganho; senão "—" — nunca divide por zero nem inventa um número. */
function cplOrCpa(spendCents: number, leads: number, wonDeals: number): string {
  if (leads > 0) return `${fmtCurrency(spendCents / leads)} / lead`
  if (wonDeals > 0) return `${fmtCurrency(spendCents / wonDeals)} / venda`
  return '—'
}

function roasLabel(spendCents: number, revenueCents: number): string {
  if (spendCents <= 0 || revenueCents <= 0) return '—'
  return `${(revenueCents / spendCents).toFixed(2)}x`
}

/**
 * Anúncios → Visão Geral (issue #24) — dashboard consolidado de TODAS as
 * contas/plataformas conectadas, não uma conta por vez (isso continua nas
 * abas Meta Ads/Google Ads, que preservam o painel granular existente).
 * Só soma métricas semanticamente comparáveis entre providers (investimento,
 * impressões, cliques, leads, receita atribuída) — métricas exclusivas de
 * um provider (ex.: conversas iniciadas do Meta) ficam de fora do
 * consolidado e continuam disponíveis dentro da aba daquele provider.
 */
export default function MarketingOverviewCrossChannel({
  orgSlug,
  period,
  overview,
  accounts,
}: {
  orgSlug: string
  period: string
  overview: Overview
  accounts: Account[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const base = `/app/${orgSlug}/marketing`

  const noAccountsYet = accounts.length === 0
  const noCampaignsYet = overview.campaigns.length === 0

  function refresh() {
    startTransition(() => router.refresh())
  }

  // Sem filtro de conta/objetivo/campanha — é exatamente isso que faz este
  // hook devolver os totais/série somados de TODAS as contas (issue #24 §2/§3).
  const { filteredTotals, filteredTimeSeries } = useMarketingOverviewMetrics(overview, 'all', null, 'all')

  const ctr = filteredTotals.impressions > 0 ? (filteredTotals.clicks / filteredTotals.impressions) * 100 : 0
  const cpc = filteredTotals.clicks > 0 ? filteredTotals.spend_cents / 100 / filteredTotals.clicks : 0
  const cpl = filteredTotals.leads > 0 ? filteredTotals.spend_cents / 100 / filteredTotals.leads : 0

  const byAccount = summarizeByAccount(overview.campaigns)
  const totalSpend = byAccount.reduce((a, r) => a + r.spend_cents, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodTabs />
        {!noAccountsYet && (
          <NewAccountTrigger orgSlug={orgSlug} onDone={refresh} variant="outline" label="Nova conta" />
        )}
      </div>

      {(noAccountsYet || noCampaignsYet) && (
        <MarketingOverviewSetupBanner
          orgSlug={orgSlug}
          accounts={accounts}
          noAccountsYet={noAccountsYet}
          noCampaignsYet={noCampaignsYet}
          onDone={refresh}
        />
      )}

      {!noAccountsYet && !noCampaignsYet && (
        <>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <KPICard label="Investimento" value={fmtCurrency(filteredTotals.spend_cents / 100)} icon={DollarSign} iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
            <KPICard label="Cliques" value={fmtNumber(filteredTotals.clicks)} sublabel={`CTR: ${ctr.toFixed(2)}%`} icon={MousePointerClick} iconBg="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" />
            <KPICard label="Leads" value={fmtNumber(filteredTotals.leads)} sublabel={filteredTotals.leads > 0 ? `CPL: ${fmtCurrency(cpl)}` : undefined} icon={Users} iconBg="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
            <KPICard label="CPC médio" value={fmtCurrency(cpc)} icon={Target} iconBg="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" />
            <KPICard label="Receita atribuída" value={fmtCurrency(filteredTotals.revenue_cents / 100)} sublabel={`${fmtNumber(filteredTotals.won_deals)} negócio(s) ganho(s)`} icon={Receipt} iconBg="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
            <KPICard label="ROAS" value={roasLabel(filteredTotals.spend_cents, filteredTotals.revenue_cents)} icon={TrendingUp} iconBg="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução das métricas</CardTitle>
              <p className="text-xs text-muted-foreground">Investimento e leads, somados de todas as contas, dia a dia.</p>
            </CardHeader>
            <CardContent>
              <MetricsChart data={filteredTimeSeries} visible={OVERVIEW_CHART_METRICS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por plataforma</CardTitle>
              <p className="text-xs text-muted-foreground">
                Uma linha por conta conectada — clique numa conta pra abrir sua aba de detalhe.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">% do total</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CPL/CPA</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAccount.map(row => {
                    const pct = totalSpend > 0 ? Math.round((row.spend_cents / totalSpend) * 100) : 0
                    const tabSegment = PROVIDER_TAB_SEGMENT[row.provider]
                    const nameCell = (
                      <div className="min-w-0">
                        <div className="font-medium truncate">{row.account_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {PROVIDER_LABELS[row.provider] || row.provider}
                        </div>
                      </div>
                    )
                    return (
                      <TableRow key={row.ad_account_id}>
                        <TableCell>
                          {tabSegment ? (
                            <Link href={`${base}/${tabSegment}?account=${row.ad_account_id}&period=${period}`} className="hover:underline underline-offset-2">
                              {nameCell}
                            </Link>
                          ) : nameCell}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCurrency(row.spend_cents / 100)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{pct}%</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNumber(row.leads)}</TableCell>
                        <TableCell className="text-right tabular-nums">{cplOrCpa(row.spend_cents / 100, row.leads, row.won_deals)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCurrency(row.revenue_cents / 100)}</TableCell>
                        <TableCell className="text-right tabular-nums">{roasLabel(row.spend_cents, row.revenue_cents)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtCurrency(filteredTotals.spend_cents / 100)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">100%</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtNumber(filteredTotals.leads)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{cplOrCpa(filteredTotals.spend_cents / 100, filteredTotals.leads, filteredTotals.won_deals)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtCurrency(filteredTotals.revenue_cents / 100)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{roasLabel(filteredTotals.spend_cents, filteredTotals.revenue_cents)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
