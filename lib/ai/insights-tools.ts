/**
 * Read-only analytics tools for the AI Analyst (dashboard chat).
 *
 * Each tool returns BOTH a plaintext summary (Claude reads it to reason about
 * the answer) AND a structured `view` payload (the UI parses it to render a
 * chart/table card). The tool's textual result sent back to the model is the
 * JSON-stringified shape — Claude can read either.
 *
 * Tools are intentionally narrow: each one answers a specific class of
 * question. Adding new tools is straightforward (push to ANALYTICS_TOOLS +
 * add a case here). Resist the urge to make one mega-tool — Claude routes
 * better with explicit, single-purpose tools.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchNormalizedSales, isOrgTravelNiche } from '@/lib/dashboard/sales-source'

export type AnalyticsContext = {
  orgId: string
  supabase: SupabaseClient
}

/* ------- View payload (shape consumed by the UI) ------- */

export type AnalyticsView =
  | { type: 'kpis'; items: Array<{ label: string; value: string; delta?: number; deltaLabel?: string }> }
  | { type: 'time_series'; data: Array<Record<string, any>>; series: Array<{ key: string; label: string; color?: string }> }
  | { type: 'bar'; data: Array<{ name: string; value: number }>; color?: string }
  | { type: 'pie'; data: Array<{ name: string; value: number }> }
  | { type: 'table'; columns: string[]; rows: any[][] }
  | { type: 'none' }

export type AnalyticsResult = {
  summary: string
  view: AnalyticsView
}

/* ------- Tool definitions ------- */

const PERIOD_PARAM = {
  type: 'string',
  description:
    'Período de análise. Aceita: "7d", "30d", "90d", "mtd" (mês até hoje), "qtd" (trimestre até hoje), "ytd" (ano até hoje). Padrão: "30d".',
  enum: ['7d', '30d', '90d', 'mtd', 'qtd', 'ytd'],
}

export const ANALYTICS_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'consultar_kpis',
    description:
      'Retorna os KPIs principais do negócio no período: novos leads, vendas, faturamento, taxa de conversão, ticket médio — com comparativo automático com o período anterior. Use SEMPRE que o usuário pedir um resumo, panorama, "como está o negócio", "visão geral" ou métricas agregadas.',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_vendas',
    description:
      'Consulta vendas no período, opcionalmente agrupadas. Use quando o usuário pedir "vendas", "faturamento", "evolução de vendas", "vendas por mês", "vendas por produto", "vendas por vendedor", "quanto vendi".',
    input_schema: {
      type: 'object',
      properties: {
        periodo: PERIOD_PARAM,
        agrupar_por: {
          type: 'string',
          enum: ['dia', 'mes', 'produto', 'vendedor'],
          description:
            'Como agrupar as vendas. "dia"/"mes" geram série temporal (gráfico de linha). "produto"/"vendedor" geram ranking (gráfico de barras). Padrão: "mes" para períodos longos, "dia" para curtos.',
        },
      },
    },
  },
  {
    name: 'consultar_pipeline',
    description:
      'Funil de conversão: quantos leads estão em cada estágio, valor agregado e a TAXA DE CONVERSÃO entre estágios (quanto % passa de um pro próximo, e do primeiro ao último). Use para "como está o funil", "onde estou perdendo mais leads", "taxa de conversão", "pipeline".',
    input_schema: {
      type: 'object',
      properties: {
        periodo: PERIOD_PARAM,
        pipeline_id: {
          type: 'string',
          description: 'ID opcional de pipeline específico. Se omitido, usa o padrão da org.',
        },
      },
    },
  },
  {
    name: 'consultar_forecast',
    description:
      'Projeção de receita: quanto já foi fechado no mês + quanto é esperado do pipeline atual (ponderado pela probabilidade histórica de cada estágio fechar). Use para "forecast", "previsão de receita", "quanto vou faturar", "projeção do mês/trimestre".',
    input_schema: {
      type: 'object',
      properties: {
        pipeline_id: {
          type: 'string',
          description: 'ID opcional de pipeline específico. Se omitido, considera o(s) pipeline(s) padrão da org.',
        },
      },
    },
  },
  {
    name: 'consultar_agendamentos',
    description:
      'Resumo de agendamentos no período (status + próximos da semana). Use para "agendamentos", "agenda", "compromissos", "consultas marcadas", "quantas consultas".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_marketing',
    description:
      'Performance de campanhas no período: investimento, CPL, leads, ROI. Use para "campanhas", "tráfego", "anúncios", "marketing", "quanto gastei", "qual campanha vai melhor".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_top_leads',
    description:
      'Lista os N leads mais quentes/recentes/valiosos da org. Use para "melhores leads", "leads mais quentes", "top clientes", "quem vale mais", "mostre os leads recentes".',
    input_schema: {
      type: 'object',
      properties: {
        criterio: {
          type: 'string',
          enum: ['score', 'valor', 'recente', 'sem_contato'],
          description:
            '"score" = maior ai_score. "valor" = maior value_cents. "recente" = mais recentes. "sem_contato" = mais tempo sem atividade.',
        },
        n: {
          type: 'integer',
          description: 'Quantos leads listar (1 a 20). Padrão: 10.',
        },
      },
      required: ['criterio'],
    },
  },
  {
    name: 'consultar_cotacoes',
    description:
      'Resumo das cotações/propostas de viagem no período: quantidade, valor total, distribuição por status (rascunho, enviada, aprovada etc.) e taxa de aprovação. Use para "cotações", "propostas", "orçamentos enviados", "quantas propostas", "taxa de aprovação de propostas".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_reservas',
    description:
      'Resumo das reservas/vendas de viagem fechadas no período: quantidade, faturamento, comissão total e ticket médio, com distribuição por status. Use para "reservas", "vendas de viagem", "viagens vendidas", "faturamento de viagens", "comissão".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
  {
    name: 'consultar_embarques',
    description:
      'Lista os próximos embarques (viagens com data de partida futura) nos próximos N dias. Use para "embarques", "próximas viagens", "quem viaja em breve", "partidas da semana", "agenda de viagens".',
    input_schema: {
      type: 'object',
      properties: {
        dias: {
          type: 'integer',
          description: 'Janela de dias à frente para listar embarques (1 a 180). Padrão: 30.',
        },
      },
    },
  },
  {
    name: 'consultar_ofertas',
    description:
      'Resumo das ofertas/pacotes da vitrine de viagens: total cadastrado, publicados vs. rascunho e distribuição por categoria. Use para "ofertas", "pacotes", "vitrine", "quantos pacotes publicados".',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'consultar_tarefas',
    description:
      'Panorama operacional das tarefas: quantas em aberto, em andamento, concluídas e vencidas (atrasadas). Use para "tarefas", "pendências", "o que está atrasado", "tarefas vencidas", "produtividade da equipe".',
    input_schema: {
      type: 'object',
      properties: { periodo: PERIOD_PARAM },
    },
  },
]

/* ------- Executor dispatcher ------- */

export async function executeAnalyticsTool(
  name: string,
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  try {
    switch (name) {
      case 'consultar_kpis':
        return await queryKpis(input, ctx)
      case 'consultar_vendas':
        return await querySales(input, ctx)
      case 'consultar_pipeline':
        return await queryPipeline(input, ctx)
      case 'consultar_forecast':
        return await queryForecast(input, ctx)
      case 'consultar_agendamentos':
        return await queryAppointments(input, ctx)
      case 'consultar_marketing':
        return await queryMarketing(input, ctx)
      case 'consultar_top_leads':
        return await queryTopLeads(input, ctx)
      case 'consultar_cotacoes':
        return await queryQuotes(input, ctx)
      case 'consultar_reservas':
        return await queryReservations(input, ctx)
      case 'consultar_embarques':
        return await queryDepartures(input, ctx)
      case 'consultar_ofertas':
        return await queryOffers(input, ctx)
      case 'consultar_tarefas':
        return await queryTasks(input, ctx)
      default:
        return {
          summary: `Tool desconhecida: ${name}`,
          view: { type: 'none' },
        }
    }
  } catch (e: any) {
    return {
      summary: `Erro ao executar ${name}: ${e?.message || 'falha inesperada'}`,
      view: { type: 'none' },
    }
  }
}

/* ------- Helpers ------- */

type Period = '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd'

function periodWindow(period: Period | string | undefined): {
  start: Date
  prevStart: Date
  prevEnd: Date
  label: string
} {
  const now = new Date()
  const start = new Date()
  const prevStart = new Date()
  const prevEnd = new Date()
  switch ((period as Period) || '30d') {
    case '7d':
      start.setDate(now.getDate() - 7)
      prevStart.setDate(now.getDate() - 14)
      prevEnd.setDate(now.getDate() - 7)
      return { start, prevStart, prevEnd, label: 'últimos 7 dias' }
    case '90d':
      start.setDate(now.getDate() - 90)
      prevStart.setDate(now.getDate() - 180)
      prevEnd.setDate(now.getDate() - 90)
      return { start, prevStart, prevEnd, label: 'últimos 90 dias' }
    case 'mtd': {
      start.setTime(new Date(now.getFullYear(), now.getMonth(), 1).getTime())
      // Same span in previous month for comparison.
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const daysIn = (now.getTime() - start.getTime()) / 86_400_000
      prevStart.setTime(prevMonthStart.getTime())
      prevEnd.setTime(prevMonthStart.getTime() + daysIn * 86_400_000)
      return { start, prevStart, prevEnd, label: 'mês atual' }
    }
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3)
      start.setTime(new Date(now.getFullYear(), q * 3, 1).getTime())
      prevStart.setTime(new Date(now.getFullYear(), q * 3 - 3, 1).getTime())
      prevEnd.setTime(start.getTime())
      return { start, prevStart, prevEnd, label: 'trimestre atual' }
    }
    case 'ytd': {
      start.setTime(new Date(now.getFullYear(), 0, 1).getTime())
      prevStart.setTime(new Date(now.getFullYear() - 1, 0, 1).getTime())
      prevEnd.setTime(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime())
      return { start, prevStart, prevEnd, label: 'ano atual' }
    }
    case '30d':
    default:
      start.setDate(now.getDate() - 30)
      prevStart.setDate(now.getDate() - 60)
      prevEnd.setDate(now.getDate() - 30)
      return { start, prevStart, prevEnd, label: 'últimos 30 dias' }
  }
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

function pctChange(current: number, previous: number): number {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}

/* ------- Tool implementations ------- */

async function queryKpis(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { start, prevStart, prevEnd, label } = periodWindow(input.periodo)
  const supabase = ctx.supabase

  // New leads + appointments (current + previous period).
  const [
    { count: leadsCur },
    { count: leadsPrev },
    { count: apptCur },
    { count: apptPrev },
  ] = await Promise.all([
    supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .gte('created_at', start.toISOString()),
    supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', prevEnd.toISOString()),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .neq('status', 'canceled')
      .gte('start_time', start.toISOString()),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .neq('status', 'canceled')
      .gte('start_time', prevStart.toISOString())
      .lt('start_time', prevEnd.toISOString()),
  ])

  // Niche-aware sales (travel orgs → travel_sales). Fetch since prevStart and
  // split into current/previous windows client-side.
  const salesRows = await fetchNormalizedSales(supabase as any, ctx.orgId, {
    since: prevStart,
    onlyCompleted: true,
  })
  const inWindow = (d: string, s: Date, e?: Date) => {
    const t = new Date(d).getTime()
    return t >= s.getTime() && (!e || t < e.getTime())
  }
  const salesCur = salesRows.filter(r => inWindow(r.date, start))
  const salesPrev = salesRows.filter(r => inWindow(r.date, prevStart, prevEnd))

  const revenueCur = salesCur.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const revenuePrev = salesPrev.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const salesCount = salesCur.length
  const ticketMedio = salesCount > 0 ? revenueCur / salesCount : 0
  const conversao = leadsCur && leadsCur > 0 ? (salesCount / leadsCur) * 100 : 0

  const items = [
    {
      label: 'Novos leads',
      value: String(leadsCur || 0),
      delta: pctChange(leadsCur || 0, leadsPrev || 0),
      deltaLabel: 'vs. período anterior',
    },
    {
      label: 'Vendas',
      value: String(salesCount),
      delta: pctChange(salesCount, (salesPrev || []).length),
    },
    {
      label: 'Faturamento',
      value: fmtCurrency(revenueCur),
      delta: pctChange(revenueCur, revenuePrev),
    },
    {
      label: 'Ticket médio',
      value: fmtCurrency(ticketMedio),
    },
    {
      label: 'Conversão',
      value: `${conversao.toFixed(1)}%`,
    },
    {
      label: 'Agendamentos',
      value: String(apptCur || 0),
      delta: pctChange(apptCur || 0, apptPrev || 0),
    },
  ]

  const summary = `KPIs do período (${label}): ${leadsCur || 0} novos leads (${pctChange(leadsCur || 0, leadsPrev || 0).toFixed(1)}% vs. anterior), ${salesCount} vendas totalizando ${fmtCurrency(revenueCur)}, ticket médio ${fmtCurrency(ticketMedio)}, conversão de ${conversao.toFixed(1)}%, ${apptCur || 0} agendamentos.`

  return { summary, view: { type: 'kpis', items } }
}

async function querySales(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const groupBy: string = input.agrupar_por || (((input.periodo as string) || '30d') === '7d' ? 'dia' : 'mes')

  // Niche-aware: travel orgs record sales in travel_sales (no product dimension).
  if (await isOrgTravelNiche(ctx.supabase as any, ctx.orgId)) {
    const rows = await fetchNormalizedSales(ctx.supabase as any, ctx.orgId, { since: start })
    if (rows.length === 0) {
      return { summary: `Sem vendas registradas no período (${label}).`, view: { type: 'none' } }
    }

    if (groupBy === 'dia' || groupBy === 'mes') {
      const bucketKey = (d: string) => (groupBy === 'dia' ? d.slice(0, 10) : d.slice(0, 7))
      const bucketed = new Map<string, number>()
      for (const r of rows) bucketed.set(bucketKey(r.date), (bucketed.get(bucketKey(r.date)) || 0) + (r.amount_cents || 0))
      const seriesData = Array.from(bucketed.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total }))
      const total = seriesData.reduce((a, p) => a + p.total, 0)
      return {
        summary: `${rows.length} vendas de viagem no período (${label}), totalizando ${fmtCurrency(total)}, agrupadas por ${groupBy}.`,
        view: {
          type: 'time_series',
          data: seriesData,
          series: [{ key: 'total', label: 'Vendas (R$)', color: '#3b82f6' }],
        },
      }
    }

    if (groupBy === 'produto') {
      const total = rows.reduce((a, r) => a + (r.amount_cents || 0), 0)
      return {
        summary: `Vendas de viagem não são agrupadas por produto. Total no período (${label}): ${rows.length} vendas, ${fmtCurrency(total)}.`,
        view: { type: 'none' },
      }
    }

    // vendedor
    const bucketed = new Map<string, number>()
    for (const r of rows) {
      const k = r.seller_id || 'Sem vendedor'
      bucketed.set(k, (bucketed.get(k) || 0) + (r.amount_cents || 0))
    }
    const data = Array.from(bucketed.entries())
      .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
    return {
      summary: `Top ${data.length} vendedores por faturamento de viagens no período (${label}).`,
      view: { type: 'bar', data, color: '#10b981' },
    }
  }

  const { data: sales } = await ctx.supabase
    .from('sales')
    .select('sale_date, amount_cents, product_id, seller_id, products(name)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'completed')
    .gte('sale_date', start.toISOString().slice(0, 10))
    .order('sale_date', { ascending: true })

  if (!sales || sales.length === 0) {
    return {
      summary: `Sem vendas registradas no período (${label}).`,
      view: { type: 'none' },
    }
  }

  // Time series (dia/mês)
  if (groupBy === 'dia' || groupBy === 'mes') {
    const bucketKey = (d: string) =>
      groupBy === 'dia' ? d : d.slice(0, 7) // YYYY-MM
    const bucketed = new Map<string, number>()
    for (const s of sales) {
      const key = bucketKey(s.sale_date)
      bucketed.set(key, (bucketed.get(key) || 0) + (s.amount_cents || 0))
    }
    const seriesData = Array.from(bucketed.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))
    const total = seriesData.reduce((a, p) => a + p.total, 0)
    return {
      summary: `${sales.length} vendas no período (${label}), totalizando ${fmtCurrency(total)}, agrupadas por ${groupBy}.`,
      view: {
        type: 'time_series',
        data: seriesData,
        series: [{ key: 'total', label: 'Vendas (R$)', color: '#3b82f6' }],
      },
    }
  }

  // Bar chart (produto/vendedor)
  const dimension = groupBy === 'produto' ? 'product' : 'seller'
  const bucketed = new Map<string, number>()
  for (const s of sales) {
    const key =
      dimension === 'product'
        ? ((Array.isArray(s.products) ? s.products[0]?.name : (s.products as any)?.name) ||
          'Sem produto')
        : s.seller_id || 'Sem vendedor'
    bucketed.set(key, (bucketed.get(key) || 0) + (s.amount_cents || 0))
  }
  const data = Array.from(bucketed.entries())
    .map(([name, cents]) => ({ name, value: Math.round(cents / 100) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  return {
    summary: `Top ${data.length} ${dimension === 'product' ? 'produtos' : 'vendedores'} por faturamento no período (${label}).`,
    view: { type: 'bar', data, color: '#10b981' },
  }
}

async function queryPipeline(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { getAdvancedFunnel } = await import('@/actions/dashboard')
  const periodo = (input.periodo as string) || '30d'
  const result = await getAdvancedFunnel(ctx.orgId, {
    period: periodo as any,
    source: { kind: 'all' },
    pipelineId: input.pipeline_id || null,
  })

  if (result.stages.length === 0) {
    return { summary: 'Nenhum estágio de pipeline configurado.', view: { type: 'none' } }
  }

  return {
    summary: `${result.total_leads} leads no funil, conversão geral de ${result.overall_conversion_pct.toFixed(1)}% (do 1º ao último estágio), valor agregado ${fmtCurrency(result.total_value_cents)}. Por estágio: ${result.stages.map(s => `${s.name} — ${s.count} leads (${s.conversion_from_previous.toFixed(0)}% do estágio anterior)`).join('; ')}.`,
    view: {
      type: 'table',
      columns: ['Estágio', 'Leads', 'Valor', 'Conversão do anterior'],
      rows: result.stages.map(s => [s.name, String(s.count), fmtCurrency(s.value_cents), `${s.conversion_from_previous.toFixed(0)}%`]),
    },
  }
}

async function queryForecast(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { getRevenueForecast } = await import('@/actions/dashboard')
  const forecast = await getRevenueForecast(ctx.orgId, { pipelineId: input.pipeline_id || null })

  if (forecast.stages.length === 0 && forecast.already_won_cents === 0) {
    return { summary: 'Sem dados suficientes no pipeline para projetar receita.', view: { type: 'none' } }
  }

  const items = [
    { label: 'Já ganho (mês)', value: fmtCurrency(forecast.already_won_cents) },
    { label: 'Esperado do pipeline', value: fmtCurrency(forecast.total_expected_cents) },
    { label: 'Projeção combinada', value: fmtCurrency(forecast.combined_forecast_cents) },
  ]

  const byStage = forecast.stages
    .map(s => `${s.stage_name} (${(s.probability * 100).toFixed(0)}% de ${s.lead_count} leads)`)
    .join(', ')

  return {
    summary: `Forecast do mês: já ganho ${fmtCurrency(forecast.already_won_cents)} + esperado do pipeline ${fmtCurrency(forecast.total_expected_cents)} = projeção combinada de ${fmtCurrency(forecast.combined_forecast_cents)}.${byStage ? ` Por estágio: ${byStage}.` : ''}`,
    view: { type: 'kpis', items },
  }
}

async function queryAppointments(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('appointments')
    .select('status')
    .eq('organization_id', ctx.orgId)
    .gte('start_time', start.toISOString())

  if (!data || data.length === 0) {
    return { summary: `Sem agendamentos no período (${label}).`, view: { type: 'none' } }
  }

  const counts = new Map<string, number>()
  for (const a of data) counts.set(a.status, (counts.get(a.status) || 0) + 1)

  const STATUS_LABEL: Record<string, string> = {
    scheduled: 'Agendados',
    completed: 'Concluídos',
    canceled: 'Cancelados',
  }

  const pieData = Array.from(counts.entries()).map(([k, v]) => ({
    name: STATUS_LABEL[k] || k,
    value: v,
  }))

  const total = data.length
  const completed = counts.get('completed') || 0
  const canceled = counts.get('canceled') || 0
  const noShowRate = total > 0 ? (canceled / total) * 100 : 0

  return {
    summary: `${total} agendamentos no período (${label}): ${completed} concluídos, ${counts.get('scheduled') || 0} marcados, ${canceled} cancelados. Taxa de cancelamento: ${noShowRate.toFixed(1)}%.`,
    view: { type: 'pie', data: pieData },
  }
}

async function queryMarketing(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)

  const { data: campaigns } = await ctx.supabase
    .from('campaigns')
    .select('id, name, utm_campaign')
    .eq('organization_id', ctx.orgId)

  if (!campaigns || campaigns.length === 0) {
    return { summary: 'Sem campanhas cadastradas.', view: { type: 'none' } }
  }

  const campaignIds = campaigns.map(c => c.id)
  const [{ data: metrics }, { data: subs }] = await Promise.all([
    ctx.supabase
      .from('campaign_metrics_daily')
      .select('campaign_id, spend_cents')
      .in('campaign_id', campaignIds)
      .eq('organization_id', ctx.orgId)
      .gte('date', start.toISOString().slice(0, 10)),
    ctx.supabase
      .from('form_submissions')
      .select('utm_campaign')
      .gte('created_at', start.toISOString())
      .not('utm_campaign', 'is', null),
  ])

  const spendByCampaign = new Map<string, number>()
  for (const m of metrics || [])
    spendByCampaign.set(m.campaign_id, (spendByCampaign.get(m.campaign_id) || 0) + (m.spend_cents || 0))

  const leadsByUtm = new Map<string, number>()
  for (const s of subs || []) {
    const k = String(s.utm_campaign || '').toLowerCase().trim()
    if (!k) continue
    leadsByUtm.set(k, (leadsByUtm.get(k) || 0) + 1)
  }

  const rows = campaigns
    .map(c => {
      const spend = spendByCampaign.get(c.id) || 0
      const leads = c.utm_campaign ? leadsByUtm.get(c.utm_campaign.toLowerCase().trim()) || 0 : 0
      const cpl = leads > 0 ? spend / leads : 0
      return {
        name: c.name,
        spend,
        leads,
        cpl,
      }
    })
    .filter(r => r.spend > 0 || r.leads > 0)
    .sort((a, b) => b.spend - a.spend)

  if (rows.length === 0) {
    return {
      summary: `Sem dados de marketing no período (${label}).`,
      view: { type: 'none' },
    }
  }

  const totalSpend = rows.reduce((a, r) => a + r.spend, 0)
  const totalLeads = rows.reduce((a, r) => a + r.leads, 0)

  return {
    summary: `${rows.length} campanhas ativas no período (${label}). Total investido: ${fmtCurrency(totalSpend)}, ${totalLeads} leads atribuídos, CPL médio ${fmtCurrency(totalLeads > 0 ? totalSpend / totalLeads : 0)}.`,
    view: {
      type: 'table',
      columns: ['Campanha', 'Investimento', 'Leads', 'CPL'],
      rows: rows
        .slice(0, 15)
        .map(r => [r.name, fmtCurrency(r.spend), String(r.leads), r.cpl > 0 ? fmtCurrency(r.cpl) : '—']),
    },
  }
}

async function queryTopLeads(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const criterio = (input.criterio || 'recente') as string
  const n = Math.min(20, Math.max(1, Number(input.n) || 10))

  let q = ctx.supabase
    .from('contatos')
    .select('id, name, email, phone, value_cents, ai_score, ai_tier, source, updated_at, created_at')
    .eq('organization_id', ctx.orgId)
    .limit(n)

  switch (criterio) {
    case 'score':
      q = q.not('ai_score', 'is', null).order('ai_score', { ascending: false })
      break
    case 'valor':
      q = q.gt('value_cents', 0).order('value_cents', { ascending: false })
      break
    case 'sem_contato':
      q = q.order('updated_at', { ascending: true })
      break
    case 'recente':
    default:
      q = q.order('created_at', { ascending: false })
      break
  }

  const { data } = await q
  if (!data || data.length === 0) {
    return { summary: 'Nenhum lead encontrado.', view: { type: 'none' } }
  }

  return {
    summary: `Top ${data.length} leads por critério "${criterio}".`,
    view: {
      type: 'table',
      columns: ['Nome', 'Contato', 'Score', 'Valor', 'Origem'],
      rows: data.map(l => [
        l.name || '—',
        l.email || l.phone || '—',
        l.ai_score != null ? `${l.ai_score} (${l.ai_tier || ''})` : '—',
        l.value_cents ? fmtCurrency(l.value_cents) : '—',
        l.source || '—',
      ]),
    },
  }
}

/* ------- Travel-specific tools (cotações / reservas / embarques / ofertas) ------- */

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  rascunho: 'Rascunho',
  sent: 'Enviada',
  enviada: 'Enviada',
  approved: 'Aprovada',
  aprovada: 'Aprovada',
  rejected: 'Recusada',
  recusada: 'Recusada',
  expired: 'Expirada',
  expirada: 'Expirada',
}

function labelStatus(map: Record<string, string>, raw: string | null): string {
  if (!raw) return 'Sem status'
  return map[raw.toLowerCase()] || raw
}

async function queryQuotes(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('travel_proposals')
    .select('status, total_cents, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma cotação criada no período (${label}).`, view: { type: 'none' } }
  }

  const byStatus = new Map<string, number>()
  let totalCents = 0
  let approved = 0
  for (const r of rows) {
    const key = labelStatus(QUOTE_STATUS_LABEL, r.status)
    byStatus.set(key, (byStatus.get(key) || 0) + 1)
    totalCents += r.total_cents || 0
    if (['approved', 'aprovada'].includes((r.status || '').toLowerCase())) approved += 1
  }
  const approvalRate = rows.length > 0 ? (approved / rows.length) * 100 : 0

  const pieData = Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }))

  return {
    summary: `${rows.length} cotações no período (${label}), somando ${fmtCurrency(totalCents)}. ${approved} aprovadas (taxa de aprovação ${approvalRate.toFixed(1)}%). Distribuição por status: ${Array.from(byStatus.entries()).map(([k, v]) => `${k}: ${v}`).join(', ')}.`,
    view: { type: 'pie', data: pieData },
  }
}

async function queryReservations(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('status, total_cents, commission_cents, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())

  const rows = ((data as any[]) || []).filter(r => (r.status || '').toLowerCase() !== 'canceled')
  if (rows.length === 0) {
    return { summary: `Nenhuma reserva fechada no período (${label}).`, view: { type: 'none' } }
  }

  const revenue = rows.reduce((a, r) => a + (r.total_cents || 0), 0)
  const commission = rows.reduce((a, r) => a + (r.commission_cents || 0), 0)
  const ticket = rows.length > 0 ? revenue / rows.length : 0

  const items = [
    { label: 'Reservas', value: String(rows.length) },
    { label: 'Faturamento', value: fmtCurrency(revenue) },
    { label: 'Comissão', value: fmtCurrency(commission) },
    { label: 'Ticket médio', value: fmtCurrency(ticket) },
  ]

  return {
    summary: `${rows.length} reservas no período (${label}): faturamento ${fmtCurrency(revenue)}, comissão ${fmtCurrency(commission)}, ticket médio ${fmtCurrency(ticket)}.`,
    view: { type: 'kpis', items },
  }
}

async function queryDepartures(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const days = Math.min(180, Math.max(1, Number(input.dias) || 30))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const until = new Date(today)
  until.setDate(until.getDate() + days)

  const { data } = await ctx.supabase
    .from('travel_sales')
    .select('client_name, destination, departure_date, return_date, total_cents, status')
    .eq('organization_id', ctx.orgId)
    .not('departure_date', 'is', null)
    .gte('departure_date', today.toISOString().slice(0, 10))
    .lte('departure_date', until.toISOString().slice(0, 10))
    .order('departure_date', { ascending: true })
    .limit(50)

  const rows = ((data as any[]) || []).filter(r => (r.status || '').toLowerCase() !== 'canceled')
  if (rows.length === 0) {
    return { summary: `Nenhum embarque previsto nos próximos ${days} dias.`, view: { type: 'none' } }
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—'

  return {
    summary: `${rows.length} embarques previstos nos próximos ${days} dias. Próximo: ${rows[0].client_name || 'cliente'} para ${rows[0].destination || 'destino não informado'} em ${fmtDate(rows[0].departure_date)}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Destino', 'Partida', 'Retorno', 'Valor'],
      rows: rows.map(r => [
        r.client_name || '—',
        r.destination || '—',
        fmtDate(r.departure_date),
        fmtDate(r.return_date),
        r.total_cents ? fmtCurrency(r.total_cents) : '—',
      ]),
    },
  }
}

async function queryOffers(
  _input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { data } = await ctx.supabase
    .from('travel_showcase_packages')
    .select('category, is_published, total_cents')
    .eq('organization_id', ctx.orgId)

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhuma oferta/pacote cadastrado na vitrine.', view: { type: 'none' } }
  }

  const published = rows.filter(r => r.is_published).length
  const draft = rows.length - published
  const byCategory = new Map<string, number>()
  for (const r of rows) {
    const k = r.category || 'Sem categoria'
    byCategory.set(k, (byCategory.get(k) || 0) + 1)
  }
  const barData = Array.from(byCategory.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return {
    summary: `${rows.length} ofertas na vitrine: ${published} publicadas e ${draft} em rascunho. Categorias: ${barData.map(c => `${c.name} (${c.value})`).join(', ')}.`,
    view: { type: 'bar', data: barData, color: '#f59e0b' },
  }
}

async function queryTasks(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const { start, label } = periodWindow(input.periodo)
  // Tarefas criadas no período + status atual. Vencidas = due_date no passado e
  // ainda não concluídas (independente da data de criação).
  const { data } = await ctx.supabase
    .from('tasks')
    .select('status, due_date, created_at')
    .eq('organization_id', ctx.orgId)
    .gte('created_at', start.toISOString())

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma tarefa criada no período (${label}).`, view: { type: 'none' } }
  }

  const now = Date.now()
  let open = 0
  let doing = 0
  let done = 0
  let overdue = 0
  for (const t of rows) {
    const status = (t.status || 'open').toLowerCase()
    if (status === 'done') done += 1
    else if (status === 'doing') doing += 1
    else open += 1
    if (status !== 'done' && t.due_date && new Date(t.due_date).getTime() < now) overdue += 1
  }

  const items = [
    { label: 'Em aberto', value: String(open) },
    { label: 'Em andamento', value: String(doing) },
    { label: 'Concluídas', value: String(done) },
    { label: 'Vencidas', value: String(overdue) },
  ]

  return {
    summary: `${rows.length} tarefas no período (${label}): ${open} em aberto, ${doing} em andamento, ${done} concluídas e ${overdue} vencidas (atrasadas).`,
    view: { type: 'kpis', items },
  }
}
