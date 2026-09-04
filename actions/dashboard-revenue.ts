import { createClient } from '@/lib/supabase/server'
import { fetchNormalizedSales } from '@/lib/dashboard/sales-source'

/**
 * Revenue forecast, source performance, and seller ranking.
 * Split out of actions/dashboard.ts. Source performance/seller ranking
 * split further into dashboard-revenue-rankings.ts.
 */

export { getSourcePerformance, type SourceRow, getSellersRanking, type SellerRow } from './dashboard-revenue-rankings'


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

