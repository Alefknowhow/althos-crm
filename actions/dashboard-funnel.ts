import { createClient } from '@/lib/supabase/server'
import { funnelWindowStart } from './dashboard-funnel-window'

/**
 * Advanced conversion funnel (stages, source breakdown). Split out of
 * actions/dashboard.ts. Stage throughput split further into
 * dashboard-funnel-throughput.ts (window-start helper in
 * dashboard-funnel-window.ts, shared by both).
 */

export { getStageThroughput, type StageThroughputRow } from './dashboard-funnel-throughput'

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

