import { createClient } from '@/lib/supabase/server'

/**
 * Advanced conversion funnel (stages, source breakdown, throughput).
 * Split out of actions/dashboard.ts.
 */

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

export type StageThroughputRow = {
  stage_id: string
  stage_name: string
  stage_color: string | null
  stage_position: number
  count: number
}

/**
 * Funil histórico ("de onde vieram" em vez de "onde estão agora"): quantos
 * leads ENTRARAM em cada estágio durante o período, somando em todo estágio
 * que percorreram (um lead Novo→Qualificação→Proposta conta nas 3 colunas).
 * Complementa getAdvancedFunnel, que mostra só a distribuição atual.
 *
 * Reconstrói o "momento de entrada" em cada estágio a partir de
 * contato_activities (type='stage_changed', payload={from,to}) — mesma fonte
 * e mesma lógica de estágio inicial já usada em getAverageTimePerStage
 * (estágio inicial = `from` do primeiro stage_changed do lead, ou o stage_id
 * atual se o lead nunca mudou de estágio). Diferente daquela função, aqui não
 * precisamos da linha do tempo sequencial completa — só do instante em que
 * cada entrada aconteceu, pra filtrar pelo período.
 */
export async function getStageThroughput(
  orgId: string,
  filters: { period: FunnelPeriod; pipelineId: string | null },
): Promise<StageThroughputRow[]> {
  const supabase = createClient()
  const start = funnelWindowStart(filters.period)

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
  if (pipelineIds.length === 0) return []

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, color, pipeline_id')
    .in('pipeline_id', pipelineIds)
    .order('position', { ascending: true })
  if (!stages || stages.length === 0) return []

  const emptyResult = () =>
    stages.map(s => ({ stage_id: s.id, stage_name: s.name, stage_color: s.color, stage_position: s.position, count: 0 }))

  const { data: leads } = await supabase
    .from('contatos')
    .select('id, stage_id, created_at')
    .eq('organization_id', orgId)
    .in('pipeline_id', pipelineIds)
  if (!leads || leads.length === 0) return emptyResult()

  const leadIds = leads.map(l => l.id)
  const { data: changes } = await supabase
    .from('contato_activities')
    .select('contato_id, created_at, payload')
    .in('contato_id', leadIds)
    .eq('type', 'stage_changed')
    .order('created_at', { ascending: true })

  // Estágio inicial por lead = `from` do primeiro stage_changed (se houver).
  const firstFromByLead = new Map<string, string | undefined>()
  for (const c of changes || []) {
    if (!firstFromByLead.has(c.contato_id)) {
      firstFromByLead.set(c.contato_id, ((c.payload as any) || {}).from as string | undefined)
    }
  }

  const enteredBy = new Map<string, Set<string>>() // stage_id -> contato_ids que entraram nele no período

  function markEntry(stageId: string | null | undefined, contatoId: string, whenMs: number) {
    if (!stageId) return
    if (start && whenMs < start.getTime()) return
    const set = enteredBy.get(stageId) || new Set<string>()
    set.add(contatoId)
    enteredBy.set(stageId, set)
  }

  for (const lead of leads) {
    const initialStage = firstFromByLead.get(lead.id) ?? lead.stage_id
    markEntry(initialStage, lead.id, new Date(lead.created_at).getTime())
  }
  for (const c of changes || []) {
    const to = ((c.payload as any) || {}).to as string | undefined
    markEntry(to, c.contato_id, new Date(c.created_at).getTime())
  }

  return stages.map(s => ({
    stage_id: s.id,
    stage_name: s.name,
    stage_color: s.color,
    stage_position: s.position,
    count: enteredBy.get(s.id)?.size ?? 0,
  }))
}
