/**
 * Camada única de acesso ao "contexto do negócio" da org (issue #19/#45),
 * fonte de verdade em organizations.ai_business_context (ver migration
 * 0151_consolidate_ai_business_context.sql). Todo motor de IA novo deve
 * consumir daqui em vez de ler a coluna direto ou ignorar o campo.
 */

const SECTION_HEADING = '# Contexto do negócio'

/** Normaliza o texto cru vindo do banco (trim, null-safe). */
export function formatBusinessContext(raw: string | null | undefined): string {
  return (raw || '').trim()
}

/** Anexa o contexto do negócio a um system prompt existente, no mesmo
 *  formato usado por lib/ai/attendant-engine-core.ts::buildSystemBlocks(). */
export function appendBusinessContext(systemPrompt: string, raw: string | null | undefined): string {
  const context = formatBusinessContext(raw)
  if (!context) return systemPrompt
  return `${systemPrompt}\n\n${SECTION_HEADING}\n${context}`
}
