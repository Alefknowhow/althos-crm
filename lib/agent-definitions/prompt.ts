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

export function buildPersonaPromptFromDefinition(def: AgentDefinition): string {
  const roleLine = def.role_label ? `Você é ${def.name}, ${def.role_label}.` : `Você é ${def.name}.`
  const intro = roleLine + (def.description ? ` ${def.description}` : '')
  const toneLine = `# Tom e idioma\nTom: ${def.tone}. Responda sempre em ${def.language}.`
  const handoffBody = def.handoff_conditions
    ? `${def.handoff_conditions}\nQuando essas condições forem atendidas, registre um evento estruturado com a ferramenta emit_result (ex.: type "human_handoff_requested") além de responder normalmente.`
    : null
  const autonomyBody = def.autonomy_limits && Object.keys(def.autonomy_limits).length > 0 ? JSON.stringify(def.autonomy_limits) : null

  const sections = [
    intro,
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
