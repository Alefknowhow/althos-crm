import { createClient } from '@/lib/supabase/server'
import { fetchNormalizedSales, isOrgTravelNiche } from '@/lib/dashboard/sales-source'

export type Period = 'today' | '7d' | '30d' | '90d'

function getDates(period: Period) {
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

  const leadsChange = previousLeads && previousLeads > 0
    ? ((currentLeads || 0) - previousLeads) / previousLeads * 100
    : 0

  // 2. Conversões no período (leads movidos para "Fechado")
  const { data: closedStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .ilike('name', '%fechado%')
    .limit(1)
    .maybeSingle()

  let currentConversions = 0
  let previousConversions = 0
  let currentRevenue = 0

  if (closedStage) {
    let convQ = supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('stage_id', closedStage.id)
      .gte('updated_at', start.toISOString())
    if (pipelineId) convQ = convQ.eq('pipeline_id', pipelineId)
    if (sellerId) convQ = convQ.eq('assigned_to', sellerId)
    const { count: convCount } = await convQ

    currentConversions = convCount || 0

    let prevConvQ = supabase
      .from('contatos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('stage_id', closedStage.id)
      .gte('updated_at', previousStart.toISOString())
      .lte('updated_at', previousEnd.toISOString())
    if (pipelineId) prevConvQ = prevConvQ.eq('pipeline_id', pipelineId)
    if (sellerId) prevConvQ = prevConvQ.eq('assigned_to', sellerId)
    const { count: prevConvCount } = await prevConvQ

    previousConversions = prevConvCount || 0

    // Aggregated server-side via RPC so we don't pull every closed lead row
    // into Node just to sum a column.
    const { data: revenueSum } = await supabase.rpc('dashboard_revenue', {
      p_org_id: orgId,
      p_stage_id: closedStage.id,
      p_start: start.toISOString(),
      p_pipeline_id: pipelineId || null,
    })

    currentRevenue = Number(revenueSum) || 0
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
    newLeads: {
      value: currentLeads || 0,
      change: leadsChange
    },
    conversions: {
      value: currentConversions,
      change: previousConversions > 0
        ? (currentConversions - previousConversions) / previousConversions * 100
        : 0
    },
    completedTasks: {
      value: completedTasks || 0
    },
    revenue: {
      value: currentRevenue / 100 // em reais
    },
    // Comissão só faz sentido no nicho viagens; demais nichos recebem null e a
    // UI omite o card.
    commission: isTravel ? { value: commissionCents / 100 } : null,
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

export async function getFunnelData(orgId: string, pipelineId?: string | null) {
  const supabase = createClient()

  // Aggregated server-side: GROUP BY stage instead of fetching all leads.
  const { data: rows } = await supabase.rpc('dashboard_funnel', {
    p_org_id: orgId,
    p_pipeline_id: pipelineId || null,
  })
  type Row = { stage_id: string; name: string; position: number; count: number }

  const funnel = ((rows as Row[] | null) || []).map(r => ({
    name: r.name,
    value: Number(r.count) || 0,
    stageId: r.stage_id
  }))

  const funnelWithConversion = funnel.map((step, index) => {
    const prevStep = funnel[index - 1]
    const conversionRate = prevStep && prevStep.value > 0
      ? (step.value / prevStep.value) * 100
      : 100

    return {
      ...step,
      conversionRate: index === 0 ? 100 : conversionRate
    }
  })

  return funnelWithConversion
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

/* -------- Advanced Conversion Funnel (Bloco Dashboard 2.0) -------- */

export type FunnelPeriod = '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd' | 'all'

export type FunnelSource =
  | { kind: 'all' }
  | { kind: 'form'; formId: string }
  | { kind: 'campaign'; utmCampaign: string }
  | { kind: 'utm_source'; value: string }
  | { kind: 'manual' }

export type FunnelStage = {
  id: string
  name: string
  position: number
  color: string | null
  count: number
  value_cents: number
  conversion_from_previous: number // 100 for first stage
  conversion_from_first: number // % vs stage 0
}

export type FunnelResult = {
  stages: FunnelStage[]
  total_leads: number
  first_stage_count: number
  last_stage_count: number
  overall_conversion_pct: number
  total_value_cents: number
  filters_applied: { period: FunnelPeriod; source: FunnelSource; pipelineId: string | null }
}

function funnelWindowStart(period: FunnelPeriod): Date | null {
  if (period === 'all') return null
  const now = new Date()
  const d = new Date()
  switch (period) {
    case '7d':
      d.setDate(now.getDate() - 7)
      return d
    case '90d':
      d.setDate(now.getDate() - 90)
      return d
    case 'mtd':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'qtd':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1)
    case '30d':
    default:
      d.setDate(now.getDate() - 30)
      return d
  }
}

/**
 * Conversion funnel snapshot: how many leads are sitting in each stage right
 * now, filtered by entry source and creation period.
 *
 * Note on semantics: "count per stage" is the CURRENT distribution, not the
 * historical pass-through. A real flow-through funnel (X leads ever reached
 * stage Y) would need lead_activities scanning — defer to a future bloco.
 * For most operator questions ("onde estão meus leads agora?") the current
 * distribution is what they want.
 */
export async function getAdvancedFunnel(
  orgId: string,
  filters: { period: FunnelPeriod; source: FunnelSource; pipelineId: string | null },
): Promise<FunnelResult> {
  const supabase = createClient()
  const start = funnelWindowStart(filters.period)

  // Resolve which pipelines to consider (default: org's default pipeline only;
  // if pipelineId provided, use it; otherwise union all pipelines).
  let pipelineIds: string[] = []
  if (filters.pipelineId) {
    pipelineIds = [filters.pipelineId]
  } else {
    const { data } = await supabase
      .from('pipelines')
      .select('id, is_default')
      .eq('organization_id', orgId)
    pipelineIds = (data || []).filter(p => p.is_default).map(p => p.id)
    if (pipelineIds.length === 0) pipelineIds = (data || []).map(p => p.id)
  }

  if (pipelineIds.length === 0) {
    return {
      stages: [],
      total_leads: 0,
      first_stage_count: 0,
      last_stage_count: 0,
      overall_conversion_pct: 0,
      total_value_cents: 0,
      filters_applied: filters,
    }
  }

  // Stages — render order by position.
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, color, pipeline_id')
    .in('pipeline_id', pipelineIds)
    .order('position', { ascending: true })

  // Build the leads query with filters applied.
  let q = supabase
    .from('contatos')
    .select('stage_id, value_cents, source, utm')
    .eq('organization_id', orgId)
    .in('pipeline_id', pipelineIds)

  if (start) q = q.gte('created_at', start.toISOString())

  switch (filters.source.kind) {
    case 'form':
      // Resolve form name → source LIKE `form:NAME%`.
      // We don't have the form name on the leads table, only `source` text,
      // so we look the form up to get its name.
      {
        const { data: form } = await supabase
          .from('forms')
          .select('name')
          .eq('id', filters.source.formId)
          .eq('organization_id', orgId)
          .maybeSingle()
        if (form?.name) {
          // submitPublicForm stores `form:${form.name}`.
          q = q.eq('source', `form:${form.name}`)
        } else {
          // Unknown form → no leads match.
          q = q.eq('source', '__no_match__')
        }
      }
      break
    case 'campaign':
      q = q.eq('utm->>utm_campaign', filters.source.utmCampaign)
      break
    case 'utm_source':
      q = q.eq('utm->>utm_source', filters.source.value)
      break
    case 'manual':
      // Leads created manually don't have `source` set by submitPublicForm.
      // Heuristic: source IS NULL.
      q = q.is('source', null)
      break
    case 'all':
    default:
      break
  }

  const { data: leads } = await q

  // Aggregate per stage.
  const byStage = new Map<string, { count: number; value: number }>()
  for (const l of leads || []) {
    if (!l.stage_id) continue
    const cur = byStage.get(l.stage_id) || { count: 0, value: 0 }
    cur.count += 1
    cur.value += l.value_cents || 0
    byStage.set(l.stage_id, cur)
  }

  const stageRows: FunnelStage[] = (stages || []).map((s, idx, arr) => {
    const m = byStage.get(s.id) || { count: 0, value: 0 }
    const prev = idx > 0 ? byStage.get(arr[idx - 1].id) : null
    const first = byStage.get(arr[0].id)
    return {
      id: s.id,
      name: s.name,
      position: s.position,
      color: s.color,
      count: m.count,
      value_cents: m.value,
      conversion_from_previous:
        idx === 0 ? 100 : prev && prev.count > 0 ? (m.count / prev.count) * 100 : 0,
      conversion_from_first:
        idx === 0 ? 100 : first && first.count > 0 ? (m.count / first.count) * 100 : 0,
    }
  })

  const totalLeads = stageRows.reduce((a, s) => a + s.count, 0)
  const firstCount = stageRows[0]?.count || 0
  const lastCount = stageRows[stageRows.length - 1]?.count || 0
  const overall = firstCount > 0 ? (lastCount / firstCount) * 100 : 0
  const totalValue = stageRows.reduce((a, s) => a + s.value_cents, 0)

  return {
    stages: stageRows,
    total_leads: totalLeads,
    first_stage_count: firstCount,
    last_stage_count: lastCount,
    overall_conversion_pct: overall,
    total_value_cents: totalValue,
    filters_applied: filters,
  }
}

/**
 * Available source options for the funnel filter dropdown. Returns active
 * forms + active campaigns + distinct utm_source values seen on leads.
 */
export async function getFunnelSourceOptions(orgId: string) {
  const supabase = createClient()

  const [{ data: forms }, { data: campaigns }, { data: leadsWithUtm }] = await Promise.all([
    supabase
      .from('forms')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('campaigns')
      .select('name, utm_campaign')
      .eq('organization_id', orgId)
      .not('utm_campaign', 'is', null)
      .order('name', { ascending: true }),
    supabase
      .from('contatos')
      .select('utm')
      .eq('organization_id', orgId)
      .not('utm', 'is', null)
      .limit(500),
  ])

  const utmSources = new Set<string>()
  for (const l of leadsWithUtm || []) {
    const src = (l.utm as any)?.utm_source
    if (src && typeof src === 'string') utmSources.add(src)
  }

  return {
    forms: (forms || []).map(f => ({ id: f.id, name: f.name })),
    campaigns: (campaigns || []).map(c => ({
      name: c.name,
      utm_campaign: c.utm_campaign as string,
    })),
    utmSources: Array.from(utmSources).sort(),
  }
}

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

/* -------- Revenue Forecast -------- */

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

  const stageIds = stages.map(s => s.id)
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
}

/**
 * Ranks sellers by completed-sales count + sum value in the given window.
 * Returns just IDs — the UI joins with the org members list to get names.
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

  const bySeller = new Map<string, { count: number; value: number }>()
  for (const s of withSeller) {
    const k = s.seller_id as string
    const cur = bySeller.get(k) || { count: 0, value: 0 }
    cur.count += 1
    cur.value += s.amount_cents || 0
    bySeller.set(k, cur)
  }

  return Array.from(bySeller.entries())
    .map(([seller_id, m]) => ({
      seller_id,
      total_sales: m.count,
      total_value_cents: m.value,
    }))
    .sort((a, b) => b.total_value_cents - a.total_value_cents)
    .slice(0, 10)
}

// ── Configurable metric time-series ──────────────────────────────────────────
// Powers the main dashboard chart where the user picks WHICH indicator to plot
// (new leads, revenue, sales count, appointments). Returns a continuous,
// zero-filled daily series so the line never has gaps.

export type DashboardMetric = 'leads' | 'revenue' | 'sales' | 'appointments'

export const DASHBOARD_METRICS: {
  value: DashboardMetric
  label: string
  color: string
  format: 'number' | 'currency'
}[] = [
  { value: 'leads',        label: 'Novos leads',  color: '#0f62fe', format: 'number' },
  { value: 'revenue',      label: 'Receita',      color: '#24a148', format: 'currency' },
  { value: 'sales',        label: 'Vendas',       color: '#8a3ffc', format: 'number' },
  { value: 'appointments', label: 'Agendamentos', color: '#ee5396', format: 'number' },
]

export type MetricSeries = {
  metric: DashboardMetric
  label: string
  color: string
  format: 'number' | 'currency'
  total: number
  points: { date: string; value: number }[]
}

function dayKeyUTC(input: string | Date): string {
  const d = typeof input === 'string'
    ? new Date(input.length === 10 ? `${input}T00:00:00Z` : input)
    : input
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export async function getMetricTimeSeries(
  orgId: string,
  period: Period = '30d',
  metric: DashboardMetric = 'leads',
  pipelineId?: string | null,
  sellerId?: string | null,
): Promise<MetricSeries> {
  const supabase = createClient()
  const { start, now } = getDates(period)
  const meta = DASHBOARD_METRICS.find(m => m.value === metric) ?? DASHBOARD_METRICS[0]

  // Continuous, zero-filled day buckets (UTC) so the chart axis has no gaps.
  const buckets: Record<string, number> = {}
  const order: string[] = []
  const startUTC = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const endUTC   = new Date(Date.UTC(now.getUTCFullYear(),   now.getUTCMonth(),   now.getUTCDate()))
  for (let d = new Date(startUTC); d <= endUTC; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = dayKeyUTC(new Date(d))
    if (!(key in buckets)) { buckets[key] = 0; order.push(key) }
  }

  function add(ts: string | null, amount: number) {
    if (!ts) return
    const key = dayKeyUTC(ts)
    if (key in buckets) buckets[key] += amount
  }

  if (metric === 'leads') {
    let q = supabase
      .from('contatos')
      .select('created_at')
      .eq('organization_id', orgId)
      .gte('created_at', start.toISOString())
    if (pipelineId) q = q.eq('pipeline_id', pipelineId)
    if (sellerId) q = q.eq('assigned_to', sellerId)
    const { data } = await q
    ;(data ?? []).forEach((r: any) => add(r.created_at, 1))
  } else if (metric === 'revenue' || metric === 'sales') {
    // Niche-aware: travel orgs read from travel_sales, others from sales.
    const rows = await fetchNormalizedSales(supabase, orgId, { since: start })
    rows
      .filter(r => !sellerId || r.seller_id === sellerId)
      .forEach(r => add(r.date, metric === 'revenue' ? (r.amount_cents || 0) / 100 : 1))
  } else if (metric === 'appointments') {
    const { data } = await supabase
      .from('appointments')
      .select('start_time, status')
      .eq('organization_id', orgId)
      .neq('status', 'canceled')
      .gte('start_time', start.toISOString())
    ;(data ?? []).forEach((r: any) => add(r.start_time, 1))
  }

  const points = order.map(date => ({ date, value: buckets[date] }))
  const total  = points.reduce((acc, p) => acc + p.value, 0)

  return {
    metric,
    label:  meta.label,
    color:  meta.color,
    format: meta.format,
    total,
    points,
  }
}