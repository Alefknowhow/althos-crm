import { createClient } from '@/lib/supabase/server'
import type { FunnelPeriod } from './dashboard-funnel'
import { funnelWindowStart } from './dashboard-funnel-window'

/**
 * Historical stage throughput ("de onde vieram" em vez de "onde estão
 * agora"). Split out of actions/dashboard-funnel.ts.
 */

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
