'use server'

/**
 * Respostas da IA, métricas de tempo de resposta, e motivos de perda.
 * Split out of actions/dashboard-tabs.ts.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Mensagens respondidas pela IA = whatsapp_messages onde a IA de fato
 * mandou a resposta sozinha. `sent_by_name = 'IA'` já era gravado pelo
 * atendente automático (lib/inngest/whatsapp-inbound.ts) — não precisou de
 * coluna nova, só nunca tinha virado métrica de dashboard.
 */
export async function getAiAnsweredCount(orgId: string, since: Date): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('direction', 'outbound')
    .eq('sent_by_name', 'IA')
    .gte('created_at', since.toISOString())
  return count || 0
}

/* -------- Tempo/taxa de resposta (WhatsApp) -------- */

export type ResponseMetrics = { avgResponseMinutes: number | null; responseRatePct: number | null; answeredCount: number; inboundCount: number }

/**
 * Tempo médio de resposta = tempo entre uma mensagem inbound e a próxima
 * outbound na mesma conversa. Taxa de resposta = % de mensagens inbound que
 * tiveram alguma outbound depois delas, na janela analisada.
 * whatsapp_messages.direction/created_at já existiam — não precisou de
 * nenhuma instrumentação nova, só nunca tinha sido agregado.
 */
export async function getResponseMetrics(orgId: string, since: Date, limit = 5000): Promise<ResponseMetrics> {
  const supabase = createClient()
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('conversation_id, direction, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', since.toISOString())
    .order('conversation_id', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  const byConversation = new Map<string, { direction: string; created_at: string }[]>()
  for (const m of data || []) {
    const list = byConversation.get(m.conversation_id) || []
    list.push({ direction: m.direction, created_at: m.created_at })
    byConversation.set(m.conversation_id, list)
  }

  let inboundCount = 0
  let answeredCount = 0
  const responseMinutes: number[] = []

  for (const msgs of Array.from(byConversation.values())) {
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].direction !== 'inbound') continue
      inboundCount++
      const next = msgs.slice(i + 1).find((m: { direction: string }) => m.direction === 'outbound')
      if (next) {
        answeredCount++
        const diffMin = (new Date(next.created_at).getTime() - new Date(msgs[i].created_at).getTime()) / 60_000
        responseMinutes.push(diffMin)
      }
    }
  }

  return {
    avgResponseMinutes: responseMinutes.length > 0
      ? Math.round(responseMinutes.reduce((a, v) => a + v, 0) / responseMinutes.length)
      : null,
    responseRatePct: inboundCount > 0 ? Math.round((answeredCount / inboundCount) * 100) : null,
    answeredCount,
    inboundCount,
  }
}

/* -------- Motivos de perda -------- */

/** Mesma normalização de `source` usada em dashboard-revenue-rankings.ts
 *  (getSourcePerformance) — duplicada aqui (é só um switch pequeno) pra não
 *  criar uma dependência cruzada entre os dois arquivos de actions. */
function normalizeSourceLabel(source: string | null): string {
  if (!source) return 'Manual'
  if (source.startsWith('form:')) return `Formulário · ${source.slice(5)}`
  if (source.startsWith('agendamento:')) return `Agendamento · ${source.slice(12)}`
  if (source.startsWith('campaign:')) return `Campanha · ${source.slice(9)}`
  return source
}

export type LossReasonSourceSegment = { source: string; count: number }
export type LossReasonBySourceRow = {
  reason: string
  count: number
  /** % sobre o total de perdas/desqualificações no período (todas as linhas somadas). */
  pct: number
  /** Quebra da mesma linha por origem do lead — usada pra segmentar a barra. */
  bySource: LossReasonSourceSegment[]
}

/**
 * Motivos de perda = contatos.close_reason (texto livre, preenchido no
 * diálogo de mover um lead pra etapa "perdida"/"desqualificada" —
 * KanbanBoard.tsx::LostMoveDialog) agrupado por texto exato
 * (case-insensitive, trim). Não é uma taxonomia fixa — como o campo é
 * livre, motivos parecidos escritos diferente ("sem resposta" vs "Sem
 * resposta do lead") não se juntam. Ainda assim é dado real, não mock.
 *
 * Cada motivo também é quebrado por origem do lead (`source`) — uma linha
 * por motivo, segmentada por origem, com o total e o % do motivo sobre
 * todas as perdas no final.
 */
export async function getLossReasonsBySource(orgId: string, limit = 6): Promise<LossReasonBySourceRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('close_reason, source')
    .eq('organization_id', orgId)
    .in('deal_status', ['perdido', 'desqualificado'])
    .not('close_reason', 'is', null)

  type Bucket = { label: string; count: number; bySource: Map<string, number> }
  const byReason = new Map<string, Bucket>()
  let total = 0
  for (const r of data || []) {
    const reason = (r.close_reason || '').trim()
    if (!reason) continue
    const key = reason.toLowerCase()
    const bucket = byReason.get(key) || { label: reason, count: 0, bySource: new Map<string, number>() }
    bucket.count += 1
    const sourceLabel = normalizeSourceLabel(r.source)
    bucket.bySource.set(sourceLabel, (bucket.bySource.get(sourceLabel) || 0) + 1)
    byReason.set(key, bucket)
    total += 1
  }

  return Array.from(byReason.values())
    .map(b => ({
      reason: b.label,
      count: b.count,
      pct: total > 0 ? (b.count / total) * 100 : 0,
      bySource: Array.from(b.bySource.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, c) => c.count - a.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export type MqlSqlCampaignRow = { campaign: string; mql: number; sql: number }

/**
 * MQL/SQL por campanha — não existe uma coluna "is_mql"/"is_sql" no schema
 * (só a pontuação de IA em `ai_tier`/`ai_score`, lib/ai/qualifier.ts), então
 * usa uma definição por proxy, documentada aqui pra poder ser revista:
 *   MQL (Marketing Qualified Lead) = lead com `ai_tier` 'hot' ou 'warm' —
 *     a IA de qualificação avaliou o lead como bom o suficiente pra
 *     interesse comercial real, não só "chegou".
 *   SQL (Sales Qualified Lead)     = MQL que já tem `assigned_to` —
 *     vendas aceitou/está trabalhando o lead (só a IA achar bom não basta;
 *     alguém do time precisa ter assumido).
 * Segmentado por campanha (`source` = 'campaign:<utm_campaign>'); leads de
 * outras origens (manual, formulário, agendamento, direto) somam em
 * "Outras origens" pra o total continuar batendo.
 */
export async function getMqlSqlByCampaign(
  orgId: string,
  since: Date,
  options: { pipelineId?: string | null } = {},
): Promise<MqlSqlCampaignRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('contatos')
    .select('source, ai_tier, assigned_to')
    .eq('organization_id', orgId)
    .gte('created_at', since.toISOString())
    .in('ai_tier', ['hot', 'warm'])
  if (options.pipelineId) query = query.eq('pipeline_id', options.pipelineId)
  const { data } = await query

  const byCampaign = new Map<string, { mql: number; sql: number }>()
  for (const l of data || []) {
    const campaign = l.source?.startsWith('campaign:') ? l.source.slice(9) : 'Outras origens'
    const cur = byCampaign.get(campaign) || { mql: 0, sql: 0 }
    cur.mql += 1
    if (l.assigned_to) cur.sql += 1
    byCampaign.set(campaign, cur)
  }

  return Array.from(byCampaign.entries())
    .map(([campaign, v]) => ({ campaign, mql: v.mql, sql: v.sql }))
    .sort((a, b) => b.mql - a.mql)
    .slice(0, 8)
}
