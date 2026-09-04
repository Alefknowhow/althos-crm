import { createClient } from '@/lib/supabase/server'
import { fetchNormalizedSales } from '@/lib/dashboard/sales-source'

/**
 * Revenue forecast, source performance, and seller ranking.
 * Split out of actions/dashboard.ts.
 */


export type ForecastStageRow = {
  stage_id: string
  stage_name: string
  stage_position: number
  stage_color: string | null
  lead_count: number
  pipeline_value_cents: number
  probability: number // 0..1
  expected_value_cents: number
}

export type RevenueForecast = {
  stages: ForecastStageRow[]
  total_pipeline_cents: number
  total_expected_cents: number
  already_won_cents: number
  combined_forecast_cents: number
  period_label: string
}

/**
 * Revenue forecast — sum of (current pipeline value × probability of close).
 *
 * Probability strategy:
 *   1) For each non-terminal stage, look at the last 90 days of leads that
 *      passed through it; compute what % of them eventually reached the
 *      terminal stage.
 *   2) Fall back to a position-based weight when there's no historical data
 *      (new orgs): linear interpolation from 10% (first stage) to 100% (last).
 *   3) Terminal stage = 100% always.
 *
 * Plus we add the already-won value in the current month so the operator
 * sees total expected revenue for the period.
 */
export async function getRevenueForecast(
  orgId: string,
  options: { pipelineId?: string | null; sellerId?: string | null } = {},
): Promise<RevenueForecast> {
  const supabase = createClient()

  // Resolve pipeline.
  let pipelineIds: string[] = []
  if (options.pipelineId) {
    pipelineIds = [options.pipelineId]
  } else {
    const { data: defaults } = await supabase
      .from('pipelines')
      .select('id, is_default')
      .eq('organization_id', orgId)
    const def = (defaults || []).filter(p => p.is_default).map(p => p.id)
    pipelineIds = def.length > 0 ? def : (defaults || []).map(p => p.id)
  }

  if (pipelineIds.length === 0) {
    return {
      stages: [],
      total_pipeline_cents: 0,
      total_expected_cents: 0,
      already_won_cents: 0,
      combined_forecast_cents: 0,
      period_label: 'mês atual',
    }
  }

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, color, pipeline_id')
    .in('pipeline_id', pipelineIds)
    .order('position', { ascending: true })

  if (!stages || stages.length === 0) {
    return {
      stages: [],
      total_pipeline_cents: 0,
      total_expected_cents: 0,
      already_won_cents: 0,
      combined_forecast_cents: 0,
      period_label: 'mês atual',
    }
  }

  // Identify terminal stages: last position of each pipeline (convention).
  const terminalIds = new Set<string>()
  const byPipeline = new Map<string, typeof stages>()
  for (const s of stages) {
    const arr = byPipeline.get(s.pipeline_id) || []
    arr.push(s)
    byPipeline.set(s.pipeline_id, arr)
  }
  for (const arr of Array.from(byPipeline.values())) {
    const last = arr.sort((a, b) => a.position - b.position)[arr.length - 1]
    if (last) terminalIds.add(last.id)
  }

  // Current pipeline value per stage.
  let openLeadsQ = supabase
    .from('contatos')
    .select('stage_id, value_cents')
    .eq('organization_id', orgId)
    .in('pipeline_id', pipelineIds)
    .not('stage_id', 'is', null)
  if (options.sellerId) openLeadsQ = openLeadsQ.eq('assigned_to', options.sellerId)
  const { data: openLeads } = await openLeadsQ

  const byStage = new Map<string, { count: number; value: number }>()
  for (const l of openLeads || []) {
    if (!l.stage_id) continue
    const cur = byStage.get(l.stage_id) || { count: 0, value: 0 }
    cur.count += 1
    cur.value += l.value_cents || 0
    byStage.set(l.stage_id, cur)
  }

  // Historical conversion: for each non-terminal stage, what % of leads
  // that entered the stage in the last 90 days eventually reached a
  // terminal stage? Computed from lead_activities.
  const histStart = new Date()
  histStart.setDate(histStart.getDate() - 90)

  const { data: histChanges } = await supabase
    .from('contato_activities')
    .select('contato_id, payload, created_at')
    .eq('type', 'stage_changed')
    .gte('created_at', histStart.toISOString())
    .limit(5000)

  // Build: leadId → set of stages it visited.
  const visitedByLead = new Map<string, Set<string>>()
  for (const a of histChanges || []) {
    const to = (a.payload as any)?.to as string | undefined
    if (!to) continue
    const set = visitedByLead.get(a.contato_id) || new Set<string>()
    set.add(to)
    visitedByLead.set(a.contato_id, set)
  }

  // For each non-terminal stage, count "passed through" and "reached terminal".
  const histStats = new Map<string, { passed: number; reached_terminal: number }>()
  for (const [, visited] of Array.from(visitedByLead.entries())) {
    const reachedTerminal = Array.from(visited).some(sid => terminalIds.has(sid))
    for (const stageId of Array.from(visited)) {
      if (terminalIds.has(stageId)) continue
      const cur = histStats.get(stageId) || { passed: 0, reached_terminal: 0 }
      cur.passed += 1
      if (reachedTerminal) cur.reached_terminal += 1
      histStats.set(stageId, cur)
    }
  }

  // Fallback weight: linear from 0.1 to 0.95 across non-terminal stages.
  function fallbackProbability(stageIdx: number, totalStages: number, isTerminal: boolean): number {
    if (isTerminal) return 1
    if (totalStages <= 1) return 0.5
    const nonTerminal = totalStages - 1
    if (nonTerminal <= 1) return 0.5
    const min = 0.1
    const max = 0.95
    return min + (max - min) * (stageIdx / (nonTerminal - 1))
  }

  // Build forecast rows.
  const forecastRows: ForecastStageRow[] = stages.map((s, idx) => {
    const isTerminal = terminalIds.has(s.id)
    const stageData = byStage.get(s.id) || { count: 0, value: 0 }
    let probability: number
    if (isTerminal) {
      probability = 1
    } else {
      const hist = histStats.get(s.id)
      if (hist && hist.passed >= 5) {
        // Trust the data when we have at least 5 leads that passed through.
        probability = hist.reached_terminal / hist.passed
      } else {
        probability = fallbackProbability(idx, stages.length, false)
      }
    }
    return {
      stage_id: s.id,
      stage_name: s.name,
      stage_position: s.position,
      stage_color: s.color,
      lead_count: stageData.count,
      pipeline_value_cents: stageData.value,
      probability,
      expected_value_cents: Math.round(stageData.value * probability),
    }
  })

  // Already-won this month (from sales table).
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  // Niche-aware: travel orgs read already-won from travel_sales, others from sales.
  const monthSales = await fetchNormalizedSales(supabase, orgId, { since: monthStart, onlyCompleted: true })
  const alreadyWon = monthSales
    .filter(s => !options.sellerId || s.seller_id === options.sellerId)
    .reduce((a, s) => a + (s.amount_cents || 0), 0)

  // Pipeline = sum of non-terminal stage values (terminal IS already won and
  // counted separately).
  const totalPipeline = forecastRows
    .filter(r => !terminalIds.has(r.stage_id))
    .reduce((a, r) => a + r.pipeline_value_cents, 0)
  const totalExpected = forecastRows
    .filter(r => !terminalIds.has(r.stage_id))
    .reduce((a, r) => a + r.expected_value_cents, 0)

  return {
    stages: forecastRows.filter(r => !terminalIds.has(r.stage_id)),
    total_pipeline_cents: totalPipeline,
    total_expected_cents: totalExpected,
    already_won_cents: alreadyWon,
    combined_forecast_cents: totalExpected + alreadyWon,
    period_label: 'mês atual',
  }
}

/* -------- Source Performance (conversion by source) -------- */

export type SourceRow = {
  source: string
  leads: number
  won: number
  conversion_pct: number
  total_value_cents: number
}

/**
 * Per-source performance over the last `windowDays` days. Tracks leads
 * created from each source and how many ended up in a terminal stage
 * (= won). Useful to answer "which channel gives me the best ROI?".
 */
export async function getSourcePerformance(
  orgId: string,
  options: { windowDays?: number; pipelineId?: string | null } = {},
): Promise<SourceRow[]> {
  const supabase = createClient()
  const start = new Date()
  start.setDate(start.getDate() - (options.windowDays ?? 90))

  // Resolve pipeline + terminal stages.
  let pipelineIds: string[] = []
  if (options.pipelineId) {
    pipelineIds = [options.pipelineId]
  } else {
    const { data: defaults } = await supabase
      .from('pipelines')
      .select('id, is_default')
      .eq('organization_id', orgId)
    const def = (defaults || []).filter(p => p.is_default).map(p => p.id)
    pipelineIds = def.length > 0 ? def : (defaults || []).map(p => p.id)
  }

  if (pipelineIds.length === 0) return []

  const { data: allStages } = await supabase
    .from('pipeline_stages')
    .select('id, position, pipeline_id')
    .in('pipeline_id', pipelineIds)

  type StageRow = { id: string; position: number; pipeline_id: string }
  const terminalIds = new Set<string>()
  const byPipeline = new Map<string, StageRow[]>()
  for (const s of allStages || []) {
    const arr = byPipeline.get(s.pipeline_id) || []
    arr.push(s as StageRow)
    byPipeline.set(s.pipeline_id, arr)
  }
  for (const arr of Array.from(byPipeline.values())) {
    const last = arr.sort((a, b) => a.position - b.position)[arr.length - 1]
    if (last) terminalIds.add(last.id)
  }

  // Pull all leads in window with source + stage + value.
  const { data: leads } = await supabase
    .from('contatos')
    .select('source, stage_id, value_cents')
    .eq('organization_id', orgId)
    .in('pipeline_id', pipelineIds)
    .gte('created_at', start.toISOString())

  if (!leads || leads.length === 0) return []

  // Group by source bucket. Normalize: 'form:Nome' → 'Formulário Nome';
  // null/empty → 'Manual'; else the raw source string.
  const buckets = new Map<string, { leads: number; won: number; value: number }>()
  for (const l of leads) {
    let label: string
    if (!l.source) label = 'Manual'
    else if (l.source.startsWith('form:')) label = `Formulário · ${l.source.slice(5)}`
    else if (l.source.startsWith('agendamento:')) label = `Agendamento · ${l.source.slice(12)}`
    else if (l.source.startsWith('campaign:')) label = `Campanha · ${l.source.slice(9)}`
    else label = l.source

    const cur = buckets.get(label) || { leads: 0, won: 0, value: 0 }
    cur.leads += 1
    if (l.stage_id && terminalIds.has(l.stage_id)) {
      cur.won += 1
      cur.value += l.value_cents || 0
    }
    buckets.set(label, cur)
  }

  return Array.from(buckets.entries())
    .map(([source, m]) => ({
      source,
      leads: m.leads,
      won: m.won,
      conversion_pct: m.leads > 0 ? (m.won / m.leads) * 100 : 0,
      total_value_cents: m.value,
    }))
    .sort((a, b) => b.total_value_cents - a.total_value_cents || b.leads - a.leads)
    .slice(0, 8)
}

/* -------- Sellers Ranking -------- */

export type SellerRow = {
  seller_id: string
  total_sales: number
  total_value_cents: number
  /** Só > 0 no nicho viagens — genérico não tem comissão por venda. */
  commission_cents: number
}

/**
 * Ranks sellers by completed-sales count + sum value in the given window.
 * No nicho viagens ranqueia por comissão total (dado principal); nos demais
 * (sem conceito de comissão), continua por receita total. Retorna só IDs —
 * a UI junta com a lista de membros da org pra exibir nome.
 */
export async function getSellersRanking(
  orgId: string,
  options: { windowDays?: number } = {},
): Promise<SellerRow[]> {
  const supabase = createClient()
  const start = new Date()
  start.setDate(start.getDate() - (options.windowDays ?? 30))

  // Niche-aware: travel orgs rank by travel_sales (created_by), others by sales.
  const sales = await fetchNormalizedSales(supabase, orgId, { since: start, onlyCompleted: true })
  const withSeller = sales.filter(s => s.seller_id)

  if (withSeller.length === 0) return []

  const bySeller = new Map<string, { count: number; value: number; commission: number }>()
  for (const s of withSeller) {
    const k = s.seller_id as string
    const cur = bySeller.get(k) || { count: 0, value: 0, commission: 0 }
    cur.count += 1
    cur.value += s.amount_cents || 0
    cur.commission += s.commission_cents || 0
    bySeller.set(k, cur)
  }

  const hasCommission = Array.from(bySeller.values()).some(m => m.commission > 0)

  return Array.from(bySeller.entries())
    .map(([seller_id, m]) => ({
      seller_id,
      total_sales: m.count,
      total_value_cents: m.value,
      commission_cents: m.commission,
    }))
    .sort((a, b) => hasCommission ? b.commission_cents - a.commission_cents : b.total_value_cents - a.total_value_cents)
    .slice(0, 10)
}
