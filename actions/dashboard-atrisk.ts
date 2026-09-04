import { createClient } from '@/lib/supabase/server'

/**
 * Pipeline health: leads at risk of going stale, and average time spent
 * per stage. Split out of actions/dashboard.ts.
 */

/* -------- Pipeline at-risk + stage timing -------- */

export type AtRiskLead = {
  id: string
  name: string
  value_cents: number
  days_stuck: number
  last_activity_at: string
}

export type AtRiskStage = {
  stage_id: string
  stage_name: string
  stage_color: string | null
  stage_position: number
  total_in_stage: number
  at_risk_count: number
  leads: AtRiskLead[]
}

/**
 * Leads currently sitting in a stage longer than `thresholdDays` since the
 * most recent activity (either an explicit stage change or the lead's own
 * created_at if it never moved). Skips "terminal" stages — by convention,
 * positions are ordered so the final one is "won" — we treat the LAST stage
 * by position as terminal and exclude it from risk calculations.
 */
export async function getAtRiskLeads(
  orgId: string,
  options: { thresholdDays?: number; pipelineId?: string | null; perStageLimit?: number } = {},
): Promise<AtRiskStage[]> {
  const thresholdDays = options.thresholdDays ?? 7
  const perStageLimit = options.perStageLimit ?? 5
  const supabase = createClient()

  // Resolve pipeline scope.
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

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, color, pipeline_id')
    .in('pipeline_id', pipelineIds)
    .order('position', { ascending: true })

  if (!stages || stages.length === 0) return []

  // Treat the last stage as "won/terminal" so we don't flag successful deals
  // as at-risk. Exclude from the open-leads scan.
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

  // Pull open leads + their last stage change date (via lead_activities).
  const { data: openLeads } = await supabase
    .from('contatos')
    .select('id, name, stage_id, value_cents, created_at, updated_at')
    .eq('organization_id', orgId)
    .in('pipeline_id', pipelineIds)
    .not('stage_id', 'is', null)

  if (!openLeads || openLeads.length === 0) return []

  const leadIds = openLeads.map(l => l.id)
  // For each lead, find the latest stage_changed activity (if any) so we can
  // compute "time since entered current stage". Could be done with a window
  // function via RPC; for simplicity we pull and reduce in JS.
  const { data: stageChanges } = await supabase
    .from('contato_activities')
    .select('contato_id, created_at, payload')
    .in('contato_id', leadIds)
    .eq('type', 'stage_changed')
    .order('created_at', { ascending: false })

  const latestChangeByLead = new Map<string, string>()
  for (const a of stageChanges || []) {
    if (!latestChangeByLead.has(a.contato_id)) {
      latestChangeByLead.set(a.contato_id, a.created_at)
    }
  }

  const now = Date.now()
  const stageBuckets = new Map<
    string,
    { total: number; atRisk: AtRiskLead[] }
  >()

  for (const lead of openLeads) {
    if (!lead.stage_id || terminalIds.has(lead.stage_id)) continue
    const enteredStageIso = latestChangeByLead.get(lead.id) || lead.created_at
    const days = Math.floor((now - new Date(enteredStageIso).getTime()) / 86_400_000)

    const bucket = stageBuckets.get(lead.stage_id) || { total: 0, atRisk: [] }
    bucket.total += 1
    if (days >= thresholdDays) {
      bucket.atRisk.push({
        id: lead.id,
        name: lead.name || 'Sem nome',
        value_cents: lead.value_cents || 0,
        days_stuck: days,
        last_activity_at: enteredStageIso,
      })
    }
    stageBuckets.set(lead.stage_id, bucket)
  }

  // Compose final per-stage result, ordered by stage position.
  return stages
    .filter(s => !terminalIds.has(s.id))
    .map(s => {
      const b = stageBuckets.get(s.id) || { total: 0, atRisk: [] }
      // Sort at-risk leads by most stuck first.
      b.atRisk.sort((a, b) => b.days_stuck - a.days_stuck)
      return {
        stage_id: s.id,
        stage_name: s.name,
        stage_color: s.color,
        stage_position: s.position,
        total_in_stage: b.total,
        at_risk_count: b.atRisk.length,
        leads: b.atRisk.slice(0, perStageLimit),
      }
    })
    .filter(row => row.at_risk_count > 0)
}

export type TimeInStageRow = {
  stage_id: string
  stage_name: string
  stage_color: string | null
  stage_position: number
  avg_days: number
  median_days: number
  sample_size: number
}

/**
 * Average + median days leads spent in each stage, computed from
 * stage_changed activities over the last `windowDays` days.
 *
 * Methodology: for each lead, sort their stage_changed events by date. The
 * time spent in stage X is (date entered X+1) - (date entered X). For the
 * current/latest stage, we use NOW as the end. For the FIRST stage of a
 * lead (no prior change), we use lead.created_at as the entry.
 */
export async function getAverageTimePerStage(
  orgId: string,
  options: { pipelineId?: string | null; windowDays?: number } = {},
): Promise<TimeInStageRow[]> {
  const windowDays = options.windowDays ?? 90
  const supabase = createClient()
  const start = new Date()
  start.setDate(start.getDate() - windowDays)

  // Resolve pipeline scope (same logic as at-risk).
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

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, color, pipeline_id')
    .in('pipeline_id', pipelineIds)
    .order('position', { ascending: true })

  if (!stages || stages.length === 0) return []

  const stageMap = new Map(stages.map(s => [s.id, s]))

  const { data: leads } = await supabase
    .from('contatos')
    .select('id, stage_id, created_at')
    .eq('organization_id', orgId)
    .in('pipeline_id', pipelineIds)
    .gte('created_at', start.toISOString())

  if (!leads || leads.length === 0) return []
  const leadIds = leads.map(l => l.id)

  const { data: changes } = await supabase
    .from('contato_activities')
    .select('contato_id, created_at, payload')
    .in('contato_id', leadIds)
    .eq('type', 'stage_changed')
    .order('created_at', { ascending: true })

  // Build per-lead timeline: [{stage_id, entered_at}], including initial stage.
  type Entry = { stage_id: string; entered_at: number }
  const timelineByLead = new Map<string, Entry[]>()
  for (const lead of leads) {
    if (lead.stage_id) {
      timelineByLead.set(lead.id, [
        { stage_id: lead.stage_id, entered_at: new Date(lead.created_at).getTime() },
      ])
    }
  }
  // We'd love a chronological per-lead view, but the initial stage of a lead
  // when first created may differ from the "from" of the first stage_changed
  // event. We trust the first stage_changed's `from` if present.
  for (const c of changes || []) {
    const t = timelineByLead.get(c.contato_id)
    if (!t) continue
    const payload = (c.payload as any) || {}
    const to = payload.to as string | undefined
    if (!to) continue
    t.push({ stage_id: to, entered_at: new Date(c.created_at).getTime() })
  }

  // For each stage, collect durations.
  const durations = new Map<string, number[]>()
  const now = Date.now()
  for (const timeline of Array.from(timelineByLead.values())) {
    for (let i = 0; i < timeline.length; i++) {
      const cur = timeline[i]
      const next = timeline[i + 1]
      const end = next ? next.entered_at : now
      const days = Math.max(0, (end - cur.entered_at) / 86_400_000)
      const list = durations.get(cur.stage_id) || []
      list.push(days)
      durations.set(cur.stage_id, list)
    }
  }

  const result: TimeInStageRow[] = []
  for (const [stageId, list] of Array.from(durations.entries())) {
    const stage = stageMap.get(stageId)
    if (!stage) continue
    const sorted = [...list].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)
    const avg = sorted.length > 0 ? sum / sorted.length : 0
    const median =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    result.push({
      stage_id: stageId,
      stage_name: stage.name,
      stage_color: stage.color,
      stage_position: stage.position,
      avg_days: avg,
      median_days: median,
      sample_size: list.length,
    })
  }

  return result.sort((a, b) => a.stage_position - b.stage_position)
}
