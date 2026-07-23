/** Tipo de automação — escolhido ANTES do gatilho. Determina em que canal(is) ela roda. */
export type FunnelTriggerType = 'dm' | 'comment' | 'comment_and_dm' | 'story' | 'story_reply'

export const TRIGGER_TYPE_LABELS: Record<FunnelTriggerType, string> = {
  dm: 'Mensagem direta (DM)',
  comment: 'Comentário',
  comment_and_dm: 'Comentário + DM',
  story: 'Menção no story',
  story_reply: 'Resposta a um story',
}
