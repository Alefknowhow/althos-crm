/**
 * Dashboard v2 — quebras do pipeline (origem dos leads, motivos de perda,
 * aging). Split de dashboard-v2-pipeline.ts. Sem 'use server'; toda query
 * filtra organization_id.
 */

import { createClient } from '@/lib/supabase/server'
import { classifySourceLabel } from '@/lib/dashboard/source-label'
import { resolvePipelineIds, type OpenPipeline } from './dashboard-v2-pipeline'

/* ------------------------------------------------------------------ */

export type LeadOriginRow = { source: string; leads: number; won: number; conversion_pct: number }

/** Leads criados na janela por origem (contagem) + conversão (ganho ÷ leads) da mesma origem. */
export async function getLeadOrigins(
  orgId: string,
  opts: { since: Date; pipelineId?: string | null; sellerId?: string | null },
): Promise<LeadOriginRow[]> {
  const supabase = createClient()
  let q = supabase
    .from('contatos')
    .select('source, deal_status, referred_by_contato_id, referred_by_name')
    .eq('organization_id', orgId)
    .gte('created_at', opts.since.toISOString())
    .limit(20000)
  if (opts.pipelineId) {
    const ids = await resolvePipelineIds(supabase, orgId, opts.pipelineId)
    q = q.in('pipeline_id', ids)
  }
  if (opts.sellerId) q = q.eq('assigned_to', opts.sellerId)
  const { data } = await q
  const by = new Map<string, { leads: number; won: number }>()
  for (const r of (data || []) as any[]) {
    const label = classifySourceLabel(r.source, !!(r.referred_by_contato_id || r.referred_by_name))
    const cur = by.get(label) || { leads: 0, won: 0 }
    cur.leads += 1
    if (r.deal_status === 'ganho') cur.won += 1
    by.set(label, cur)
  }
  return Array.from(by.entries())
    .map(([source, v]) => ({ source, leads: v.leads, won: v.won, conversion_pct: v.leads > 0 ? (v.won / v.leads) * 100 : 0 }))
    .sort((a, b) => b.leads - a.leads)
}

/* ------------------------------------------------------------------ */

export type LossReasonRow = { reason: string; count: number; pct: number }

/** Motivos de perda (contatos.close_reason, texto livre) das oportunidades perdidas/desqualificadas
 *  fechadas na janela. Sem motivo preenchido → "Não informado". */
export async function getLossReasons(
  orgId: string,
  opts: { since: Date; pipelineId?: string | null; sellerId?: string | null; limit?: number },
): Promise<LossReasonRow[]> {
  const supabase = createClient()
  let q = supabase
    .from('contatos')
    .select('close_reason')
    .eq('organization_id', orgId)
    .in('deal_status', ['perdido', 'desqualificado'])
    .gte('closed_at', opts.since.toISOString())
    .limit(20000)
  if (opts.pipelineId) {
    const ids = await resolvePipelineIds(supabase, orgId, opts.pipelineId)
    q = q.in('pipeline_id', ids)
  }
  if (opts.sellerId) q = q.eq('assigned_to', opts.sellerId)
  const { data } = await q
  const by = new Map<string, { label: string; count: number }>()
  let total = 0
  for (const r of (data || []) as any[]) {
    const reason = String(r.close_reason || '').trim() || 'Não informado'
    const k = reason.toLowerCase()
    const cur = by.get(k) || { label: reason.charAt(0).toUpperCase() + reason.slice(1), count: 0 }
    cur.count += 1
    by.set(k, cur)
    total += 1
  }
  const sorted = Array.from(by.values()).sort((a, b) => b.count - a.count)
  const limit = opts.limit ?? 6
  const head = sorted.slice(0, limit - 1)
  const tail = sorted.slice(limit - 1)
  if (tail.length === 1) head.push(tail[0])
  else if (tail.length > 1) head.push({ label: 'Outros', count: tail.reduce((a, t) => a + t.count, 0) })
  return head.map(r => ({ reason: r.label, count: r.count, pct: total > 0 ? (r.count / total) * 100 : 0 }))
}

/* ------------------------------------------------------------------ */

export const AGING_BUCKETS = ['0-3d', '4-7d', '8-14d', '15-30d', '30+d'] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

export function agingBucket(days: number): AgingBucket {
  if (days <= 3) return '0-3d'
  if (days <= 7) return '4-7d'
  if (days <= 14) return '8-14d'
  if (days <= 30) return '15-30d'
  return '30+d'
}

export type AgingRow = { stage: string } & Record<AgingBucket, number>

/** Aging do pipeline: oportunidades abertas por estágio × faixa de dias parado. */
export function buildAging(open: OpenPipeline): AgingRow[] {
  return open.stages.map(s => {
    const row = { stage: s.name, '0-3d': 0, '4-7d': 0, '8-14d': 0, '15-30d': 0, '30+d': 0 } as AgingRow
    for (const d of open.deals) if (d.stage_id === s.id) row[agingBucket(d.idle_days)] += 1
    return row
  })
}
