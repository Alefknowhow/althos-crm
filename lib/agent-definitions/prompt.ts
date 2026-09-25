import type { AgentDefinition } from './types'

/**
 * Compõe o personaPrompt (lib/ai/attendant-engine-core.ts::AttendantInput)
 * a partir de um Agent Definition. Business Context (#45) continua sendo
 * passado à parte pelo caller de invokeAgentDefinition — não duplicado
 * aqui — e é anexado pelo próprio motor (buildSystemBlocks).
 */
function optionalSection(heading: string, body: string | null | undefined): string | null {
  return body ? `# ${heading}\n${body}` : null
}

export type BuildPersonaPromptOptions = {
  /**
   * false quando o caller NÃO oferece a tool emit_result (ex.: WhatsApp via
   * lib/inngest/whatsapp-inbound.ts, que só tem ATTENDANT_TOOLS) — instruir
   * o modelo a chamar uma ferramenta inexistente é pior que não instruir
   * nada (achado da revisão automática da PR #52). Default true: os
   * callers que usam invokeAgentDefinition()/o Orquestrador sempre têm
   * emit_result disponível (ver lib/agent-definitions/tools.ts).
   */
  supportsStructuredResults?: boolean
  /**
   * Objetivo DESTA execução específica (ex.: passado por um step de
   * automação "Iniciar/atribuir conversa a Agente IA", issue #18) — mostrado
   * junto do objetivo fixo da definição, não no lugar dele. `def.objective`
   * é "por que esse papel existe"; isto aqui é "o que fazer agora nesta
   * conversa", e pode mudar a cada invocação sem tocar na Agent Definition.
   */
  runtimeObjective?: string | null
}

export function buildPersonaPromptFromDefinition(def: AgentDefinition, opts?: BuildPersonaPromptOptions): string {
  const supportsStructuredResults = opts?.supportsStructuredResults ?? true
  const roleLine = def.role_label ? `Você é ${def.name}, ${def.role_label}.` : `Você é ${def.name}.`
  const intro = roleLine + (def.description ? ` ${def.description}` : '')
  const toneLine = `# Tom e idioma\nTom: ${def.tone}. Responda sempre em ${def.language}.`
  const handoffBody = def.handoff_conditions
    ? supportsStructuredResults
      ? `${def.handoff_conditions}\nQuando essas condições forem atendidas, registre um evento estruturado com a ferramenta emit_result (ex.: type "human_handoff_requested") além de responder normalmente.`
      : `${def.handoff_conditions}\nQuando essas condições forem atendidas, siga a orientação de transferência para atendimento humano já configurada para este canal.`
    : null
  const autonomyBody = def.autonomy_limits && Object.keys(def.autonomy_limits).length > 0 ? JSON.stringify(def.autonomy_limits) : null

  const sections = [
    intro,
    optionalSection('Objetivo desta conversa (definido por quem iniciou esta execução agora)', opts?.runtimeObjective),
    optionalSection('Objetivo', def.objective),
    optionalSection('Critérios de sucesso', def.success_criteria),
    optionalSection('Personalidade (como você se comporta)', def.personality),
    optionalSection('Persona (com quem você fala)', def.persona),
    toneLine,
    optionalSection('Regras', def.rules),
    optionalSection('Instruções adicionais', def.additional_instructions),
    optionalSection('Conhecimento específico deste agente', def.knowledge),
    optionalSection('Condições de handoff', handoffBody),
    optionalSection('Limites de autonomia', autonomyBody),
  ]

  return sections.filter((s): s is string => !!s).join('\n\n')
}
