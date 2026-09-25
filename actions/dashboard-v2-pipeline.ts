/**
 * Dashboard v2 — pipeline/eficiência comercial (abas Visão Geral e Pipeline).
 *
 * Sem 'use server' (server-only, chamado por Server Components). Toda query
 * filtra `organization_id`; `orgId` é sempre resolvido no servidor.
 *
 * Modelo de dados usado:
 *   - `contatos` é a oportunidade (stage_id, value_cents, deal_status
 *     aberto/ganho/perdido/desqualificado, closed_at, close_reason,
 *     assigned_to, last_activity_at, source).
 *   - `pipeline_stages` (position, is_won, is_lost).
 *   - `contato_activities` type='stage_changed' payload {from,to} — histórico
 *     de passagem por estágio.
 *   - Probabilidade por estágio: a mesma de getRevenueForecast
 *     (histórico de 90 dias, fallback por posição).
 */

import { createClient } from '@/lib/supabase/server'
import { getRevenueForecast } from './dashboard-revenue'

type Supa = ReturnType<typeof createClient>
const DAY = 86_400_000

export async function resolvePipelineIds(supabase: Supa, orgId: string, pipelineId: string | null | undefined): Promise<string[]> {
  if (pipelineId) {
    // Garante que o pipeline pedido pertence à org (nunca confiar no id vindo da URL).
    const { data } = await supabase.from('pipelines').select('id').eq('organization_id', orgId).eq('id', pipelineId).maybeSingle()
    return data ? [pipelineId] : []
  }
  const { data } = await supabase.from('pipelines').select('id, is_default').eq('organization_id', orgId)
  const def = (data || []).filter(p => p.is_default).map(p => p.id)
  return def.length > 0 ? def : (data || []).map(p => p.id)
}

type StageRow = { id: string; name: string; position: number; color: string | null; pipeline_id: string; is_won: boolean; is_lost: boolean }

async function fetchStages(supabase: Supa, pipelineIds: string[]): Promise<StageRow[]> {
  if (pipelineIds.length === 0) return []
  const { data } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, color, pipeline_id, is_won, is_lost')
    .in('pipeline_id', pipelineIds)
    .order('position', { ascending: true })
  return (data || []) as StageRow[]
}

async function fetchStageVisits(supabase: Supa, orgId: string, contatoIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  for (let i = 0; i < contatoIds.length; i += 300) {
    const chunk = contatoIds.slice(i, i + 300)
    const { data } = await supabase
      .from('contato_activities')
      .select('contato_id, payload')
      .eq('organization_id', orgId)
      .eq('type', 'stage_changed')
      .in('contato_id', chunk)
      .limit(20000)
    for (const a of (data || []) as any[]) {
      const set = out.get(a.contato_id) || new Set<string>()
      if (a.payload?.to) set.add(a.payload.to)
      if (a.payload?.from) set.add(a.payload.from)
      out.set(a.contato_id, set)
    }
  }
  return out
}

/* ------------------------------------------------------------------ */

export type StepFunnelStage = {
  id: string
  name: string
  color: string | null
  /** Oportunidades que chegaram pelo menos até este estágio. */
  reached: number
  value_cents: number
  /** % que avançou para o próximo estágio (null no último). */
  conv_next_pct: number | null
  /** % deste estágio que chegou até o ganho. */
  to_won_pct: number | null
  is_won: boolean
}

export type StepFunnel = { stages: StepFunnelStage[]; total: number; won: number; overall_pct: number }

/**
 * Funil de passagem ("step funnel"): para cada oportunidade criada na janela,
 * o estágio mais avançado que ela alcançou (estágio atual + histórico de
 * stage_changed). Oportunidades ganhas contam em todos os estágios.
 * Estágios de perda (is_lost) ficam fora da escada. Diferente de
 * getAdvancedFunnel (distribuição atual), aqui a contagem é sempre
 * decrescente e a conversão entre estágios nunca passa de 100%.
 */
export async function getStepFunnel(
  orgId: string,
  opts: { since: Date; pipelineId?: string | null; sellerId?: string | null },
): Promise<StepFunnel> {
  const supabase = createClient()
  const pipelineIds = await resolvePipelineIds(supabase, orgId, opts.pipelineId)
  const empty: StepFunnel = { stages: [], total: 0, won: 0, overall_pct: 0 }
  if (pipelineIds.length === 0) return empty
  const allStages = await fetchStages(supabase, pipelineIds)
  // Com vários pipelines na mesma visão, usa a escada do primeiro (default) —
  // estágios de pipelines diferentes não são comparáveis entre si.
  const ladder = allStages.filter(s => s.pipeline_id === pipelineIds[0] && !s.is_lost)
  if (ladder.length === 0) return empty
  const idxById = new Map(ladder.map((s, i) => [s.id, i]))
  const wonIdx = ladder.findIndex(s => s.is_won)
  const lastIdx = ladder.length - 1

  let q = supabase
    .from('contatos')
    .select('id, stage_id, value_cents, deal_status')
    .eq('organization_id', orgId)
    .eq('pipeline_id', pipelineIds[0])
    .gte('created_at', opts.since.toISOString())
    .limit(20000)
  if (opts.sellerId) q = q.eq('assigned_to', opts.sellerId)
  const { data: leads } = await q
  const rows = (leads || []) as { id: string; stage_id: string | null; value_cents: number | null; deal_status: string | null }[]
  if (rows.length === 0) return { ...empty, stages: ladder.map(s => ({ id: s.id, name: s.name, color: s.color, reached: 0, value_cents: 0, conv_next_pct: null, to_won_pct: null, is_won: s.is_won })) }

  const visits = await fetchStageVisits(supabase, orgId, rows.map(r => r.id))
  const reached = new Array(ladder.length).fill(0)
  const value = new Array(ladder.length).fill(0)
  for (const r of rows) {
    let max = -1
    if (r.deal_status === 'ganho') max = wonIdx >= 0 ? wonIdx : lastIdx
    else {
      if (r.stage_id && idxById.has(r.stage_id)) max = idxById.get(r.stage_id)!
      for (const sid of Array.from(visits.get(r.id) || [])) {
        const i = idxById.get(sid)
        if (i !== undefined && i > max) max = i
      }
      if (max < 0) max = 0 // perdido sem histórico: entrou pelo menos no 1º estágio
      if (wonIdx >= 0 && max >= wonIdx) max = wonIdx - 1 // não ganho não conta no estágio de ganho
    }
    for (let i = 0; i <= max; i++) {
      reached[i] += 1
      value[i] += r.value_cents || 0
    }
  }

  const finalIdx = wonIdx >= 0 ? wonIdx : lastIdx
  const won = reached[finalIdx]
  const stages = ladder.map((s, i) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    reached: reached[i],
    value_cents: value[i],
    conv_next_pct: i < ladder.length - 1 && reached[i] > 0 ? (reached[i + 1] / reached[i]) * 100 : null,
    to_won_pct: reached[i] > 0 && i <= finalIdx ? (won / reached[i]) * 100 : null,
    is_won: s.is_won,
  }))
  return { stages, total: rows.length, won, overall_pct: rows.length > 0 ? (won / rows.length) * 100 : 0 }
}

/* ------------------------------------------------------------------ */

export type OpenDeal = {
  id: string
  name: string
  value_cents: number
  stage_id: string
  stage_name: string
  stage_color: string | null
  assigned_to: string | null
  /** Dias desde a última interação (last_activity_at → updated_at → created_at). */
  idle_days: number
  last_interaction_at: string
  probability: number
  risk: 'alto' | 'medio' | 'baixo'
  risk_reason: string
}

export type OpenPipeline = {
  deals: OpenDeal[]
  stages: { id: string; name: string; color: string | null; count: number; value_cents: number; probability: number }[]
  total_value_cents: number
  weighted_value_cents: number
  /** Soma do que já foi ganho no mês (vendas) — vem de getRevenueForecast. */
  won_this_month_cents: number
}

function riskOf(idle: number, probability: number, value: number, avgValue: number): { risk: OpenDeal['risk']; reason: string } {
  const big = avgValue > 0 && value >= avgValue * 1.5
  if (idle >= 14) return { risk: 'alto', reason: big ? `Alto valor parado há ${idle}d` : `Sem interação há ${idle}d` }
  if (idle >= 7) return { risk: big || probability >= 0.5 ? 'alto' : 'medio', reason: probability >= 0.5 ? 'Etapa avançada esfriando' : `Sem interação há ${idle}d` }
  if (idle >= 3) return { risk: 'baixo', reason: 'Follow-up recomendado' }
  return { risk: 'baixo', reason: 'Em andamento' }
}

/** Oportunidades abertas (deal_status='aberto') com estágio, probabilidade e risco. */
export async function getOpenPipeline(
  orgId: string,
  opts: { pipelineId?: string | null; sellerId?: string | null } = {},
): Promise<OpenPipeline> {
  const supabase = createClient()
  const pipelineIds = await resolvePipelineIds(supabase, orgId, opts.pipelineId)
  const empty: OpenPipeline = { deals: [], stages: [], total_value_cents: 0, weighted_value_cents: 0, won_this_month_cents: 0 }
  if (pipelineIds.length === 0) return empty

  const [stages, forecast] = await Promise.all([
    fetchStages(supabase, pipelineIds),
    getRevenueForecast(orgId, { pipelineId: opts.pipelineId ?? null, sellerId: opts.sellerId ?? null }),
  ])
  const probByStage = new Map(forecast.stages.map(s => [s.stage_id, s.probability]))
  const openStages = stages.filter(s => !s.is_won && !s.is_lost)
  const stageById = new Map(openStages.map(s => [s.id, s]))

  let q = supabase
    .from('contatos')
    .select('id, name, value_cents, stage_id, assigned_to, last_activity_at, updated_at, created_at')
    .eq('organization_id', orgId)
    .in('pipeline_id', pipelineIds)
    .eq('deal_status', 'aberto')
    .not('stage_id', 'is', null)
    .limit(20000)
  if (opts.sellerId) q = q.eq('assigned_to', opts.sellerId)
  const { data } = await q
  const rows = ((data || []) as any[]).filter(r => stageById.has(r.stage_id))
  const avgValue = rows.length > 0 ? rows.reduce((a, r) => a + (r.value_cents || 0), 0) / rows.length : 0
  const now = Date.now()

  const deals: OpenDeal[] = rows.map(r => {
    const s = stageById.get(r.stage_id)!
    const last = r.last_activity_at || r.updated_at || r.created_at
    const idle = Math.max(0, Math.floor((now - new Date(last).getTime()) / DAY))
    const probability = probByStage.get(r.stage_id) ?? 0.5
    const { risk, reason } = riskOf(idle, probability, r.value_cents || 0, avgValue)
    return {
      id: r.id,
      name: r.name || 'Sem nome',
      value_cents: r.value_cents || 0,
      stage_id: s.id,
      stage_name: s.name,
      stage_color: s.color,
      assigned_to: r.assigned_to ?? null,
      idle_days: idle,
      last_interaction_at: last,
      probability,
      risk,
      risk_reason: reason,
    }
  })

  const stageAgg = openStages.map(s => {
    const ds = deals.filter(d => d.stage_id === s.id)
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      count: ds.length,
      value_cents: ds.reduce((a, d) => a + d.value_cents, 0),
      probability: probByStage.get(s.id) ?? 0.5,
    }
  })

  return {
    deals,
    stages: stageAgg,
    total_value_cents: deals.reduce((a, d) => a + d.value_cents, 0),
    weighted_value_cents: Math.round(deals.reduce((a, d) => a + d.value_cents * d.probability, 0)),
    won_this_month_cents: forecast.already_won_cents,
  }
}

/* ------------------------------------------------------------------ */

export type PipelineKpis = {
  new_opportunities: number
  previous_new_opportunities: number | null
  won_in_period: number
  conversion_pct: number
  previous_conversion_pct: number | null
  /** Dias médios entre criação e fechamento (ganho) das oportunidades fechadas na janela. */
  avg_cycle_days: number | null
  /** Receita fechada ÷ oportunidades fechadas (ganho) na janela — usado na velocidade. */
  avg_won_value_cents: number
}

export async function getPipelineKpis(
  orgId: string,
  opts: { start: Date; previousStart: Date; previousEnd: Date; pipelineId?: string | null; sellerId?: string | null },
): Promise<PipelineKpis> {
  const supabase = createClient()
  const pipelineIds = await resolvePipelineIds(supabase, orgId, opts.pipelineId)
  const base = () => {
    let q = supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
    if (opts.pipelineId) q = q.in('pipeline_id', pipelineIds)
    if (opts.sellerId) q = q.eq('assigned_to', opts.sellerId)
    return q
  }
  const hasPrev = opts.previousStart.getTime() !== opts.previousEnd.getTime()

  let wonQ = supabase
    .from('contatos')
    .select('value_cents, created_at, closed_at')
    .eq('organization_id', orgId)
    .eq('deal_status', 'ganho')
    .gte('closed_at', opts.start.toISOString())
    .limit(20000)
  if (opts.pipelineId) wonQ = wonQ.in('pipeline_id', pipelineIds)
  if (opts.sellerId) wonQ = wonQ.eq('assigned_to', opts.sellerId)

  const [{ count: cur }, prevRes, { data: won }, prevWonRes] = await Promise.all([
    base().gte('created_at', opts.start.toISOString()),
    hasPrev ? base().gte('created_at', opts.previousStart.toISOString()).lte('created_at', opts.previousEnd.toISOString()) : Promise.resolve({ count: null }),
    wonQ,
    hasPrev
      ? base().eq('deal_status', 'ganho').gte('closed_at', opts.previousStart.toISOString()).lte('closed_at', opts.previousEnd.toISOString())
      : Promise.resolve({ count: null }),
  ])

  const wonRows = (won || []) as { value_cents: number | null; created_at: string; closed_at: string }[]
  const cycles = wonRows.map(r => (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / DAY).filter(d => d >= 0)
  const newOpp = cur || 0
  const prevNew = (prevRes as { count: number | null }).count
  const prevWon = (prevWonRes as { count: number | null }).count
  return {
    new_opportunities: newOpp,
    previous_new_opportunities: hasPrev ? prevNew ?? 0 : null,
    won_in_period: wonRows.length,
    conversion_pct: newOpp > 0 ? (wonRows.length / newOpp) * 100 : 0,
    previous_conversion_pct: hasPrev && prevNew ? ((prevWon || 0) / prevNew) * 100 : null,
    avg_cycle_days: cycles.length > 0 ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
    avg_won_value_cents: wonRows.length > 0 ? Math.round(wonRows.reduce((a, r) => a + (r.value_cents || 0), 0) / wonRows.length) : 0,
  }
}

export { getLeadOrigins, getLossReasons, buildAging, agingBucket, AGING_BUCKETS } from './dashboard-v2-pipeline-breakdowns'
export type { LeadOriginRow, LossReasonRow, AgingRow, AgingBucket } from './dashboard-v2-pipeline-breakdowns'
