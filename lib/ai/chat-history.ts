export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/**
 * Filtra o histórico persistido pra só o que a API da Claude aceita como
 * turno de conversa (user/assistant) — mensagens de sistema/erro gravadas no
 * mesmo histórico (ex.: role 'system' de falha de IA) não vão pro modelo.
 * Repetido antes em 4 lugares (Copiloto, Insights, sandbox do Agente IA,
 * chat financeiro) com o mesmo filter+cast — consolidado aqui.
 */
export function sanitizeChatHistory(prior: { role: string; content: string }[] | null | undefined): ChatTurn[] {
  return (prior || []).filter(
    (m): m is ChatTurn => m.role === 'user' || m.role === 'assistant',
  )
}
