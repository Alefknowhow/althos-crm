'use server'

/**
 * Financial dashboard: accounts overview, strategic indicators, alerts,
 * and the combined dashboard-data fetch. Split out of actions/financial.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { requireFinancialAccess, withEffectiveStatus, type FinancialEntryRow } from './financial-shared'
import {
  getFinancialSummary, getFinancialKpis, getCashFlowSeries, getExpensesByCategory,
  getRevenueBreakdown, getExpenseBreakdown, type FinancialKpis, type RevenueBreakdown,
} from './financial-summary'
import {
  getSimpleDRE, getDailyCashFlow, getUpcomingDueEntries, getCashFlowProjection, type CashFlowProjection,
} from './financial-reports'

export type AccountsBucketEntry = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  valor_cents: number
  vencimento: string
  status: FinancialEntryRow['status']
}
export type AccountsOverview = {
  vencidas: AccountsBucketEntry[]
  hoje: AccountsBucketEntry[]
  estaSemana: AccountsBucketEntry[]
  esteMes: AccountsBucketEntry[]
}

/**
 * Contas em 4 baldes por vencimento (vencidas / hoje / esta semana / este
 * mês) — cada lançamento aparece em só um balde, o mais urgente que se
 * aplica, pra dar uma leitura rápida de "o que precisa de ação agora".
 */
export async function getAccountsOverview(orgSlug: string): Promise<AccountsOverview> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()

  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + (7 - today.getDay()))
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const { data } = await supabase
    .from('financial_entries')
    .select('id, tipo, categoria, valor_cents, vencimento, status')
    .eq('organization_id', org.id)
    .in('status', ['pendente', 'vencido'])
    .not('vencimento', 'is', null)
    .lte('vencimento', monthEnd.toISOString().slice(0, 10))
    .order('vencimento', { ascending: true })
    .limit(500)

  const rows = ((data as AccountsBucketEntry[]) ?? []).map(e => withEffectiveStatus(e as any)) as AccountsBucketEntry[]

  const overview: AccountsOverview = { vencidas: [], hoje: [], estaSemana: [], esteMes: [] }
  for (const row of rows) {
    if (row.vencimento < todayIso) overview.vencidas.push(row)
    else if (row.vencimento === todayIso) overview.hoje.push(row)
    else if (row.vencimento <= weekEnd.toISOString().slice(0, 10)) overview.estaSemana.push(row)
    else overview.esteMes.push(row)
  }
  return overview
}

export type StrategicIndicators = {
  burnRateCents: number
  runwayMonths: number | null
  ebitdaCents: number
  pontoEquilibrioCents: number | null
  inadimplenciaPct: number | null
  receitaPrevistaCrmCents: number
}

/**
 * Indicadores estratégicos (fase 5 do redesenho). Onde o dado real não é
 * granular o bastante (EBITDA sem depreciação/juros/impostos separados),
 * usamos a melhor aproximação disponível a partir de financial_entries e
 * sinalizamos isso na UI — não bloqueia a entrega enquanto a granularidade
 * completa não existir.
 */
export async function getStrategicIndicators(orgSlug: string, range: { from: string; to: string }): Promise<StrategicIndicators> {
  const { org } = await requireFinancialAccess(orgSlug)
  const supabase = createClient()

  const [monthly, dre, expenseBreakdown, kpis] = await Promise.all([
    getCashFlowSeries(orgSlug, 3),
    getSimpleDRE(orgSlug, range),
    getExpenseBreakdown(orgSlug, range),
    getFinancialKpis(orgSlug, range),
  ])

  // Burn rate = média das despesas mensais líquidas dos últimos 3 meses.
  const burnRateCents = monthly.length > 0
    ? Math.round(monthly.reduce((a, m) => a + m.despesas_cents, 0) / monthly.length)
    : 0
  const runwayMonths = burnRateCents > 0 ? kpis.saldoEmCaixa.value_cents / burnRateCents : null

  // EBITDA aproximado: resultado do período (não separa depreciação/juros/
  // impostos, que não existem como campos próprios em financial_entries).
  const ebitdaCents = dre.resultado_cents

  // Ponto de equilíbrio: receita necessária pra cobrir custos fixos, dado o
  // percentual de custo variável sobre a receita do período.
  const variableCostRatio = dre.receita_total_cents > 0 ? expenseBreakdown.variaveisCents / dre.receita_total_cents : null
  const pontoEquilibrioCents = variableCostRatio !== null && variableCostRatio < 1
    ? Math.round(expenseBreakdown.fixasCents / (1 - variableCostRatio))
    : null

  // Inadimplência: % das contas a receber em aberto que já estão vencidas.
  const { data: openReceivables } = await supabase
    .from('financial_entries')
    .select('valor_cents, status, vencimento')
    .eq('organization_id', org.id)
    .eq('tipo', 'receita')
    .in('status', ['pendente', 'vencido'])
  const openRows = (openReceivables || []).map(r => withEffectiveStatus(r as any))
  const totalAbertoCents = openRows.reduce((a, r: any) => a + r.valor_cents, 0)
  const vencidoCents = openRows.filter((r: any) => r.status === 'vencido').reduce((a, r: any) => a + r.valor_cents, 0)
  const inadimplenciaPct = totalAbertoCents > 0 ? (vencidoCents / totalAbertoCents) * 100 : null

  // Receita prevista via CRM: soma do valor dos negócios em aberto no funil
  // (estimativa, não uma previsão financeira confirmada).
  const { data: openDeals } = await supabase
    .from('contatos')
    .select('value_cents')
    .eq('organization_id', org.id)
    .eq('deal_status', 'aberto')
  const receitaPrevistaCrmCents = (openDeals || []).reduce((a, d) => a + (d.value_cents || 0), 0)

  return { burnRateCents, runwayMonths, ebitdaCents, pontoEquilibrioCents, inadimplenciaPct, receitaPrevistaCrmCents }
}

export type FinancialAlert = { kind: 'risk' | 'opportunity'; text: string }

/**
 * Deriva os alertas a partir dos dados já buscados pra dashboard (zero
 * queries extras) — cada regra é um limiar simples e explicável, priorizando
 * o que exige ação (risco) antes do que é só uma boa notícia (oportunidade).
 */
function computeFinancialAlerts(d: {
  kpis: FinancialKpis
  cashFlowProjection: CashFlowProjection
  accountsOverview: AccountsOverview
  revenueBreakdown: RevenueBreakdown
  strategicIndicators: StrategicIndicators
}): FinancialAlert[] {
  const alerts: FinancialAlert[] = []

  if (d.cashFlowProjection.checkpoints.d30 < 0) {
    alerts.push({ kind: 'risk', text: 'O fluxo de caixa previsto fica negativo dentro de 30 dias.' })
  }
  if (d.accountsOverview.vencidas.length > 0) {
    alerts.push({ kind: 'risk', text: `${d.accountsOverview.vencidas.length} conta(s) vencida(s) precisam de atenção.` })
  }
  if (d.strategicIndicators.inadimplenciaPct !== null && d.strategicIndicators.inadimplenciaPct > 20) {
    alerts.push({ kind: 'risk', text: `Inadimplência em ${d.strategicIndicators.inadimplenciaPct.toFixed(0)}% das contas a receber em aberto.` })
  }
  if (d.kpis.margemLucroPct !== null && d.kpis.margemLucroPctPrev !== null && d.kpis.margemLucroPct < d.kpis.margemLucroPctPrev - 5) {
    alerts.push({ kind: 'risk', text: `Margem de lucro caiu ${(d.kpis.margemLucroPctPrev - d.kpis.margemLucroPct).toFixed(1)} pontos percentuais vs. período anterior.` })
  }
  if (d.kpis.despesaDoMes.delta_pct !== null && d.kpis.despesaDoMes.delta_pct > 30) {
    alerts.push({ kind: 'risk', text: `Despesas subiram ${d.kpis.despesaDoMes.delta_pct.toFixed(0)}% vs. período anterior.` })
  }
  if (d.kpis.receitaDoMes.delta_pct !== null && d.kpis.receitaDoMes.delta_pct <= -30) {
    alerts.push({ kind: 'risk', text: `Receita caiu ${Math.abs(d.kpis.receitaDoMes.delta_pct).toFixed(0)}% vs. período anterior.` })
  }
  if (d.revenueBreakdown.receitaTotalCents > 0 && d.revenueBreakdown.porCliente.length > 0) {
    const topShare = (d.revenueBreakdown.porCliente[0].valor_cents / d.revenueBreakdown.receitaTotalCents) * 100
    if (topShare > 40) {
      alerts.push({ kind: 'risk', text: `${topShare.toFixed(0)}% da receita do período vem de um único cliente (${d.revenueBreakdown.porCliente[0].label}).` })
    }
  }
  if (d.kpis.receitaDoMes.delta_pct !== null && d.kpis.receitaDoMes.delta_pct >= 40) {
    alerts.push({ kind: 'opportunity', text: `Receita cresceu ${d.kpis.receitaDoMes.delta_pct.toFixed(0)}% vs. período anterior.` })
  }

  return alerts
}

export async function getFinancialDashboardData(orgSlug: string, range: { from: string; to: string }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) {
    return {
      summary: { receitas_cents: 0, despesas_cents: 0, saldo_cents: 0 },
      monthlyCashFlow: [],
      dailyCashFlow: [],
      expensesByCategory: [],
      dre: { receita_total_cents: 0, despesas_por_categoria: [], resultado_cents: 0 },
      upcomingDue: [],
      kpis: {
        saldoEmCaixa: { value_cents: 0, delta_pct: null, trend: 'neutral' as const },
        receitaDoMes: { value_cents: 0, delta_pct: null, trend: 'neutral' as const },
        despesaDoMes: { value_cents: 0, delta_pct: null, trend: 'neutral' as const },
        lucroLiquido: { value_cents: 0, delta_pct: null, trend: 'neutral' as const },
        margemLucroPct: null,
        margemLucroPctPrev: null,
        fluxoCaixaPrevistoCents: 0,
        contasAReceberCents: 0,
        contasAPagarCents: 0,
      },
      cashFlowProjection: {
        startingBalance_cents: 0,
        series: [],
        checkpoints: { d30: 0, d60: 0, d90: 0 },
      },
      revenueBreakdown: {
        porCategoria: [], porFormaPagamento: [], porOperadora: [], porCliente: [],
        ticketMedioCents: 0, receitaRecorrenteCents: 0, receitaTotalCents: 0,
      },
      expenseBreakdown: {
        porSubcategoria: [], porCentroCusto: [], fixasCents: 0, variaveisCents: 0, despesaTotalCents: 0,
      },
      accountsOverview: { vencidas: [], hoje: [], estaSemana: [], esteMes: [] },
      strategicIndicators: {
        burnRateCents: 0, runwayMonths: null, ebitdaCents: 0, pontoEquilibrioCents: null,
        inadimplenciaPct: null, receitaPrevistaCrmCents: 0,
      },
      alerts: [] as FinancialAlert[],
    }
  }
  const [summary, monthlyCashFlow, dailyCashFlow, expensesByCategory, dre, upcomingDue, kpis, cashFlowProjection, revenueBreakdown, expenseBreakdown, accountsOverview, strategicIndicators] = await Promise.all([
    getFinancialSummary(orgSlug, range),
    getCashFlowSeries(orgSlug, 6),
    getDailyCashFlow(orgSlug, range),
    getExpensesByCategory(orgSlug, range),
    getSimpleDRE(orgSlug, range),
    getUpcomingDueEntries(orgSlug),
    getFinancialKpis(orgSlug, range),
    getCashFlowProjection(orgSlug, 90),
    getRevenueBreakdown(orgSlug, range),
    getExpenseBreakdown(orgSlug, range),
    getAccountsOverview(orgSlug),
    getStrategicIndicators(orgSlug, range),
  ])
  const alerts = computeFinancialAlerts({ kpis, cashFlowProjection, accountsOverview, revenueBreakdown, strategicIndicators })
  return { summary, monthlyCashFlow, dailyCashFlow, expensesByCategory, dre, upcomingDue, kpis, cashFlowProjection, revenueBreakdown, expenseBreakdown, accountsOverview, strategicIndicators, alerts }
}
