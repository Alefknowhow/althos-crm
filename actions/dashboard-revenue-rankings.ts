import { createClient } from '@/lib/supabase/server'
import { fetchNormalizedSales } from '@/lib/dashboard/sales-source'

/**
 * Source performance and seller ranking for the dashboard.
 * Split out of actions/dashboard-revenue.ts.
 */

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
