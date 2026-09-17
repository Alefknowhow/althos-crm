/**
 * Lista unificada de Conversas (WhatsApp + Instagram) — mescla as duas
 * listas (tabelas totalmente separadas por baixo,
 * whatsapp_conversations vs. social_conversations) numa única sequência
 * ordenada por atividade recente. Puramente de exibição: cada canal
 * continua com seu próprio fluxo de detalhe/envio (WhatsappChat vs.
 * SocialInbox) — isso aqui só decide o que aparece, em que ordem, na
 * barra lateral única.
 */

export type UnifiedConversationRow = {
  id: string
  channel: 'whatsapp' | 'instagram'
  name: string
  avatarUrl: string | null
  preview: string | null
  lastMessageAt: string | null
  unreadCount: number
  assignedTo: string | null
  stageName: string | null
  stageColor: string | null
  archived: boolean
}

export function mergeConversationsByRecency(
  whatsapp: UnifiedConversationRow[],
  instagram: UnifiedConversationRow[],
): UnifiedConversationRow[] {
  return [...whatsapp, ...instagram].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return tb - ta
  })
}
