import type { AgentDefinition } from './types'

/** Cenários conhecidos hoje (issue #49) — texto livre no banco, sem enum
 *  fechado; isto é só uma referência pra quem for criar/ler atribuições. */
export const SCENARIO_WHATSAPP_INBOUND = 'whatsapp.inbound'

type MinimalSupabase = {
  from: (table: string) => any
}

/**
 * Resolve o Agent Definition atribuído a um cenário, se houver e estiver
 * ativo (ambos — a atribuição E a definição). Ausência de resultado
 * significa "usa o comportamento legado do módulo" — nunca um erro; quem
 * chama decide o fallback (ver lib/inngest/whatsapp-inbound.ts).
 *
 * Aceita qualquer client com `.from()` (admin, usado por jobs Inngest, ou o
 * client do usuário logado) — mesmo padrão de lib/ai/attendant-tools.ts.
 */
export async function resolveAssignedAgentDefinition(
  supabase: MinimalSupabase,
  organizationId: string,
  scenarioKey: string,
): Promise<AgentDefinition | null> {
  const { data: assignment } = await supabase
    .from('agent_assignments')
    .select('agent_definition_id, is_active')
    .eq('organization_id', organizationId)
    .eq('scenario_key', scenarioKey)
    .maybeSingle()
  if (!assignment?.is_active) return null

  const { data: definition } = await supabase
    .from('agent_definitions')
    .select('*')
    .eq('id', assignment.agent_definition_id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!definition?.is_active) return null

  return definition as AgentDefinition
}
