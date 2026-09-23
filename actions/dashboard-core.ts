/**
 * Core dashboard metrics: date-range resolution, KPIs, lead time series,
 * recent activities, and lead sources. Split out of actions/dashboard.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { isOrgTravelNiche } from '@/lib/dashboard/sales-source'

export type Period = 'today' | '7d' | '30d' | '90d' | 'mtd' | 'max'

// Data-teto pra "Máximo" — bem antes de qualquer conta real, funciona como
// "desde sempre" sem precisar de uma query separada sem filtro de data.
const MAX_PERIOD_START = new Date('2015-01-01T00:00:00Z')

export function getDates(period: Period) {
  const now = new Date()
  const start = new Date()
  const previousStart = new Date()
  const previousEnd = new Date()

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      previousStart.setDate(start.getDate() - 1)
      previousStart.setHours(0, 0, 0, 0)
      previousEnd.setDate(start.getDate() - 1)
      previousEnd.setHours(23, 59, 59, 999)
      break
    case '7d':
      start.setDate(now.getDate() - 7)
      previousStart.setDate(start.getDate() - 7)
      previousEnd.setDate(now.getDate() - 8)
      break
    case '30d':
      start.setDate(now.getDate() - 30)
      previousStart.setDate(start.getDate() - 30)
      previousEnd.setDate(now.getDate() - 31)
      break
    case '90d':
      start.setDate(now.getDate() - 90)
      previousStart.setDate(start.getDate() - 90)
      previousEnd.setDate(now.getDate() - 91)
      break
    case 'mtd': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return { start: monthStart, now, previousStart: prevMonthStart, previousEnd: prevMonthEnd }
    }
    case 'max':
      // Sem "período anterior" que faça sentido pra uma janela sem tamanho
      // fixo — previousStart/previousEnd ficam vazios (mesmo instante),
      // as queries de comparação naturalmente não retornam nada.
      return { start: MAX_PERIOD_START, now, previousStart: MAX_PERIOD_START, previousEnd: MAX_PERIOD_START }
  }

  return { start, now, previousStart, previousEnd }
}

export async function getDashboardMetrics(
  orgId: string,
  period: Period = '30d',
  pipelineId?: string | null,
  sellerId?: string | null,
) {
  const supabase = createClient()
  const { start, previousStart, previousEnd } = getDates(period)

  // 1. Leads novos no período
  let leadsQ = supabase
    .from('contatos')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('created_at', start.toISOString())
  if (pipelineId) leadsQ = leadsQ.eq('pipeline_id', pipelineId)
  if (sellerId) leadsQ = leadsQ.eq('assigned_to', sellerId)
  const { count: currentLeads } = await leadsQ

  let prevLeadsQ = supabase
    .from('contatos')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('created_at', previousStart.toISOString())
    .lte('created_at', previousEnd.toISOString())
  if (pipelineId) prevLeadsQ = prevLeadsQ.eq('pipeline_id', pipelineId)
  if (sellerId) prevLeadsQ = prevLeadsQ.eq('assigned_to', sellerId)
  const { count: previousLeads } = await prevLeadsQ

  // 2. Conversões no período (leads com deal_status = 'ganho', fechados dentro
  // da janela). Usa deal_status/closed_at — não mais o nome do estágio do
  // pipeline ("Fechado"): estágios de ganho são configuráveis por org via
  // pipeline_stages.is_won (ver 0042/0110), e o rótulo pode ser qualquer
  // coisa (ex.: "Venda concluída"), então casar por nome do estágio deixava
  // de contar conversões em qualquer pipeline que não usasse esse texto.
  let currentConversions = 0
  let previousConversions = 0
  let currentRevenue = 0
  let previousRevenue = 0

  {
    let convQ = supabase
      .from('contatos')
      .select('value_cents', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('deal_status', 'ganho')
      .gte('closed_at', start.toISOString())
    if (pipelineId) convQ = convQ.eq('pipeline_id', pipelineId)
    if (sellerId) convQ = convQ.eq('assigned_to', sellerId)
    const { data: convRows, count: convCount } = await convQ

    currentConversions = convCount || 0
    currentRevenue = (convRows || []).reduce((a: number, r: any) => a + (r.value_cents || 0), 0)

    let prevConvQ = supabase
      .from('contatos')
      .select('value_cents', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('deal_status', 'ganho')
      .gte('closed_at', previousStart.toISOString())
      .lte('closed_at', previousEnd.toISOString())
    if (pipelineId) prevConvQ = prevConvQ.eq('pipeline_id', pipelineId)
    if (sellerId) prevConvQ = prevConvQ.eq('assigned_to', sellerId)
    const { data: prevConvRows, count: prevConvCount } = await prevConvQ

    previousConversions = prevConvCount || 0
    previousRevenue = (prevConvRows || []).reduce((a: number, r: any) => a + (r.value_cents || 0), 0)
  }

  // 3. Tarefas concluídas
  const { count: completedTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'done')
    .gte('created_at', start.toISOString())

  // 4. Comissão no período (apenas nicho viagens — travel_sales.commission_cents).
  // Vendas canceladas são excluídas; quando há filtro de vendedor, restringe por
  // created_by (o responsável pela venda no nicho viagens).
  let commissionCents = 0
  const isTravel = await isOrgTravelNiche(supabase, orgId)
  if (isTravel) {
    let commQ = supabase
      .from('travel_sales')
      .select('commission_cents, status, created_by')
      .eq('organization_id', orgId)
      .gte('created_at', start.toISOString())
    if (sellerId) commQ = commQ.eq('created_by', sellerId)
    const { data: commRows } = await commQ
    commissionCents = (commRows || [])
      .filter((r: any) => r.status !== 'canceled')
      .reduce((a: number, r: any) => a + (r.commission_cents || 0), 0)
  }

  return {
    // `previousValue` vem cru (sem %) — quem exibe decide como comparar
    // (variação relativa vs. pontos percentuais) e como tratar ausência de
    // base de comparação (ver lib/dashboard/compare.ts, issue #26).
    newLeads: {
      value: currentLeads || 0,
      previousValue: previousLeads || 0,
    },
    conversions: {
      value: currentConversions,
      previousValue: previousConversions,
    },
    completedTasks: {
      value: completedTasks || 0
    },
    revenue: {
      value: currentRevenue / 100, // em reais
      previousValue: previousRevenue / 100,
    },
    // Comissão só faz sentido no nicho viagens; demais nichos recebem null e a
    // UI omite o card.
    commission: isTravel ? { value: commissionCents / 100 } : null,
  }
}

export type MonthlyGoalProgress = {
  /** null = meta não configurada (Configurações › Metas). */
  goalCents: number | null
  /** Receita reconhecida (contatos.deal_status='ganho') desde o início do
   *  mês corrente até agora — sempre o mês calendário, independente do
   *  período/vendedor selecionado no filtro global do Dashboard (a meta é
   *  da organização como um todo, sem recorte por vendedor). */
  realizedCents: number
}

/**
 * Progresso da meta mensal de receita (card "Meta do mês" da Visão Geral,
 * issue #26) — meta configurada x receita realizada no mês calendário
 * corrente. Mesma fonte de "receita" que o KPI "Receita" (contatos com
 * deal_status='ganho'), só que sempre limitada ao mês atual em vez do
 * período filtrado, pra bater com o que "meta do mês" significa.
 */
export async function getMonthlyGoalProgress(orgId: string): Promise<MonthlyGoalProgress> {
  const supabase = createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [{ data: org }, { data: rows }] = await Promise.all([
    supabase.from('organizations').select('monthly_revenue_goal_cents').eq('id', orgId).maybeSingle(),
    supabase
      .from('contatos')
      .select('value_cents')
      .eq('organization_id', orgId)
      .eq('deal_status', 'ganho')
      .gte('closed_at', monthStart.toISOString()),
  ])

  const realizedCents = (rows || []).reduce((a: number, r: any) => a + (r.value_cents || 0), 0)
  return {
    goalCents: (org as { monthly_revenue_goal_cents: number | null } | null)?.monthly_revenue_goal_cents ?? null,
    realizedCents,
  }
}

export async function getLeadsTimeSeries(
  orgId: string,
  period: Period = '30d',
  pipelineId?: string | null,
) {
  const supabase = createClient()
  const { start } = getDates(period)

  // Stages are still fetched separately so empty buckets render with zeroes
  // for every stage column the chart expects.
  let stagesQ = supabase
    .from('pipeline_stages')
    .select('id, name, color, pipeline_id')
    .order('position')
  if (pipelineId) stagesQ = stagesQ.eq('pipeline_id', pipelineId)
  const { data: stages } = await stagesQ

  // Aggregated server-side: one row per (day, stage) instead of one row per lead.
  const { data: rows } = await supabase.rpc('dashboard_leads_timeseries', {
    p_org_id: orgId,
    p_start: start.toISOString(),
    p_pipeline_id: pipelineId || null,
  })

  const timeData: Record<string, any> = {}
  type Row = { bucket: string; stage_id: string | null; stage_name: string | null; count: number }

  ;(rows as Row[] | null)?.forEach(row => {
    const d = new Date(row.bucket)
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
    if (!timeData[date]) {
      timeData[date] = { date }
      stages?.forEach(s => (timeData[date][s.name] = 0))
    }
    const stageName = row.stage_name || 'Outros'
    timeData[date][stageName] = (timeData[date][stageName] || 0) + Number(row.count || 0)
  })

  return Object.values(timeData)
}

export async function getRecentActivities(orgId: string) {
  const supabase = createClient()

  const { data: activities } = await supabase
    .from('contato_activities')
    .select(`
      id,
      type,
      created_at,
      payload,
      leads (
        id,
        name
      )
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10)

  return activities || []
}

export async function getLeadSources(
  orgId: string,
  period: Period = '30d',
  pipelineId?: string | null,
) {
  const supabase = createClient()
  const { start } = getDates(period)

  // Aggregated server-side: GROUP BY source.
  const { data: rows } = await supabase.rpc('dashboard_lead_sources', {
    p_org_id: orgId,
    p_start: start.toISOString(),
    p_pipeline_id: pipelineId || null,
  })
  type Row = { name: string; value: number }

  return ((rows as Row[] | null) || []).map(r => ({ name: r.name, value: Number(r.value) || 0 }))
}

