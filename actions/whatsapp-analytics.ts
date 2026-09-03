'use server'

import { createClient } from '@/lib/supabase/server'

/** Métricas de analytics do WhatsApp — usadas pela aba "WhatsApp" do
 *  dashboard (components/features/dashboard/tabs/WhatsAppTab.tsx). Somente
 *  leitura, não toca em nada do chat real (WhatsappChat.tsx) nem no envio
 *  de mensagens.
 *
 *  Fonte: whatsapp_messages (direction, created_at, conversation_id) +
 *  whatsapp_conversations (assigned_to) — ver seção 2/CLAUDE.md sobre
 *  whatsapp_conversations.assigned_to ser a coluna real de "atendente
 *  responsável" (populada em actions/whatsapp.ts ao assumir/transferir
 *  conversa, índice idx_whatsapp_conversations_assigned_to já existe).
 */

export type WhatsappHeatmapCell = { dow: number; hour: number; count: number }

export type WhatsappDailyPoint = { date: string; inbound: number; outbound: number; aiAnswered: number }

export type WhatsappAnalytics = {
  heatmap: WhatsappHeatmapCell[]
  daily: WhatsappDailyPoint[]
  avgResponseMinutes: number | null
  responseRatePct: number | null
  conversationsStarted: number
  conversationsReceived: number
  avgConversationsPerAttendant: number | null
  attendantsWithActivity: number
  totalInbound: number
  totalOutbound: number
}

// Teto de linhas por consulta — whatsapp_messages não tem retenção e pode
// crescer bastante; junto com o filtro obrigatório de organization_id +
// created_at (índice idx_whatsapp_messages_conversation_created cobre a
// ordenação por conversa, mas não filtra por org sozinho — a query abaixo
// sempre filtra organization_id primeiro) isso evita full-scan.
const MESSAGE_ROW_LIMIT = 20000

export async function getWhatsappAnalytics(
  orgId: string,
  since: Date,
  sellerId?: string | null,
): Promise<WhatsappAnalytics> {
  const supabase = createClient()

  // Quando filtrando por atendente, resolve primeiro o conjunto de
  // conversation_id atribuídas a ele — evita puxar mensagens de conversas
  // de outros atendentes só para descartar depois.
  let restrictToConvIds: Set<string> | null = null
  if (sellerId) {
    const { data: assignedConvs } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('assigned_to', sellerId)
    restrictToConvIds = new Set((assignedConvs || []).map(c => c.id))
    if (restrictToConvIds.size === 0) {
      return {
        heatmap: [],
        daily: [],
        avgResponseMinutes: null,
        responseRatePct: null,
        conversationsStarted: 0,
        conversationsReceived: 0,
        avgConversationsPerAttendant: null,
        attendantsWithActivity: 0,
        totalInbound: 0,
        totalOutbound: 0,
      }
    }
  }

  const { data: rawMessages } = await supabase
    .from('whatsapp_messages')
    .select('conversation_id, direction, created_at, sent_by_name')
    .eq('organization_id', orgId)
    .gte('created_at', since.toISOString())
    .order('conversation_id', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MESSAGE_ROW_LIMIT)

  const messages = (rawMessages || []).filter(
    m => !restrictToConvIds || restrictToConvIds.has(m.conversation_id),
  )

  // ---- Heatmap (hora x dia da semana) + série diária enviada x recebida ----
  const heatmapMap = new Map<string, number>()
  const dailyMap = new Map<string, { inbound: number; outbound: number; aiAnswered: number }>()
  let totalInbound = 0
  let totalOutbound = 0

  for (const m of messages) {
    const d = new Date(m.created_at)
    const dow = d.getDay() // 0=domingo..6=sábado
    const hour = d.getHours()
    const hKey = `${dow}-${hour}`
    heatmapMap.set(hKey, (heatmapMap.get(hKey) || 0) + 1)

    const dayKey = d.toISOString().slice(0, 10)
    const entry = dailyMap.get(dayKey) || { inbound: 0, outbound: 0, aiAnswered: 0 }
    if (m.direction === 'inbound') { entry.inbound++; totalInbound++ } else {
      entry.outbound++
      totalOutbound++
      // Mensagem enviada pelo Agente IA — lib/inngest/whatsapp-inbound.ts
      // grava sent_by_name: 'IA' em toda resposta automática.
      if ((m as any).sent_by_name === 'IA') entry.aiAnswered++
    }
    dailyMap.set(dayKey, entry)
  }

  const heatmap: WhatsappHeatmapCell[] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap.push({ dow, hour, count: heatmapMap.get(`${dow}-${hour}`) || 0 })
    }
  }

  const daily: WhatsappDailyPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, inbound: v.inbound, outbound: v.outbound, aiAnswered: v.aiAnswered }))

  // ---- Agrupamento por conversa: tempo de resposta, taxa de resposta,
  //      conversas iniciadas x recebidas ----
  const byConversation = new Map<string, { direction: string; created_at: string }[]>()
  for (const m of messages) {
    const list = byConversation.get(m.conversation_id) || []
    list.push({ direction: m.direction, created_at: m.created_at })
    byConversation.set(m.conversation_id, list)
  }

  let inboundCount = 0
  let answeredCount = 0
  const responseMinutes: number[] = []
  let conversationsStarted = 0
  let conversationsReceived = 0

  for (const msgs of Array.from(byConversation.values())) {
    if (msgs.length === 0) continue
    // "Iniciada" considera a primeira mensagem DENTRO do período — não a
    // primeira mensagem da conversa desde sempre (que exigiria buscar todo
    // o histórico). Judgement call: para conversas que já existiam antes
    // do período e só tiveram atividade nova dentro dele, isso conta a
    // primeira mensagem observada no período como "início" — aceitável
    // para uma leitura de "quem puxou o primeiro contato nesta janela".
    if (msgs[0].direction === 'outbound') conversationsStarted++
    else conversationsReceived++

    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].direction !== 'inbound') continue
      inboundCount++
      const next = msgs.slice(i + 1).find(m => m.direction === 'outbound')
      if (next) {
        answeredCount++
        const diffMin = (new Date(next.created_at).getTime() - new Date(msgs[i].created_at).getTime()) / 60_000
        responseMinutes.push(diffMin)
      }
    }
  }

  const avgResponseMinutes = responseMinutes.length > 0
    ? Math.round((responseMinutes.reduce((a, v) => a + v, 0) / responseMinutes.length) * 10) / 10
    : null
  const responseRatePct = inboundCount > 0 ? Math.round((answeredCount / inboundCount) * 100) : null

  // ---- Média de conversas por atendente ----
  // "Atendente de uma conversa" = whatsapp_conversations.assigned_to (não
  // contatos.assigned_to — este último é o responsável pelo LEAD/contato no
  // CRM em geral, assigned_to em whatsapp_conversations é especificamente
  // quem está atendendo aquela conversa de WhatsApp, populado por
  // actions/whatsapp.ts ao assumir/transferir; é o mesmo padrão já usado
  // pelo filtro "Atendente" do dashboard — SellerFilter/ctx.sellerId — e
  // por idx_whatsapp_conversations_assigned_to).
  const convIdsWithActivity = Array.from(byConversation.keys())
  let avgConversationsPerAttendant: number | null = null
  let attendantsWithActivity = 0

  if (convIdsWithActivity.length > 0) {
    const attendantByConv = new Map<string, string>()
    const CHUNK = 200
    for (let i = 0; i < convIdsWithActivity.length; i += CHUNK) {
      const chunk = convIdsWithActivity.slice(i, i + CHUNK)
      const { data: convs } = await supabase
        .from('whatsapp_conversations')
        .select('id, assigned_to')
        .eq('organization_id', orgId)
        .in('id', chunk)
      for (const c of convs || []) {
        if (c.assigned_to) attendantByConv.set(c.id, c.assigned_to)
      }
    }

    const convCountByAttendant = new Map<string, number>()
    for (const convId of convIdsWithActivity) {
      const attendant = attendantByConv.get(convId)
      if (!attendant) continue
      convCountByAttendant.set(attendant, (convCountByAttendant.get(attendant) || 0) + 1)
    }

    attendantsWithActivity = convCountByAttendant.size
    if (attendantsWithActivity > 0) {
      const totalAssignedConvs = Array.from(convCountByAttendant.values()).reduce((a, v) => a + v, 0)
      avgConversationsPerAttendant = Math.round((totalAssignedConvs / attendantsWithActivity) * 10) / 10
    }
  }

  return {
    heatmap,
    daily,
    avgResponseMinutes,
    responseRatePct,
    conversationsStarted,
    conversationsReceived,
    avgConversationsPerAttendant,
    attendantsWithActivity,
    totalInbound,
    totalOutbound,
  }
}
