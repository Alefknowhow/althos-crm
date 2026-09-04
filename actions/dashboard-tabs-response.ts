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

export type LossReasonRow = { reason: string; count: number }

/**
 * Motivos de perda = contatos.close_reason (texto livre, preenchido no
 * diálogo de mover um lead pra etapa "perdida"/"desqualificada" —
 * KanbanBoard.tsx::LostMoveDialog) agrupado por texto exato
 * (case-insensitive, trim). Não é uma taxonomia fixa — como o campo é
 * livre, motivos parecidos escritos diferente ("sem resposta" vs "Sem
 * resposta do lead") não se juntam. Ainda assim é dado real, não mock.
 */
export async function getLossReasons(orgId: string, limit = 6): Promise<LossReasonRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('close_reason')
    .eq('organization_id', orgId)
    .in('deal_status', ['perdido', 'desqualificado'])
    .not('close_reason', 'is', null)

  const byReason = new Map<string, number>()
  for (const r of data || []) {
    const reason = (r.close_reason || '').trim()
    if (!reason) continue
    const key = reason.toLowerCase()
    byReason.set(key, (byReason.get(key) || 0) + 1)
  }

  // Mantém a primeira grafia encontrada como rótulo (case original), só a
  // contagem usa a chave normalizada.
  const labelByKey = new Map<string, string>()
  for (const r of data || []) {
    const reason = (r.close_reason || '').trim()
    if (!reason) continue
    const key = reason.toLowerCase()
    if (!labelByKey.has(key)) labelByKey.set(key, reason)
  }

  return Array.from(byReason.entries())
    .map(([key, count]) => ({ reason: labelByKey.get(key) || key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
