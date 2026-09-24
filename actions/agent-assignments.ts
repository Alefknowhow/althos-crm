'use server'

/**
 * CRUD de Atribuições (issue #49) — "qual Agent Definition atua em cada
 * cenário". Mesma permissão de actions/agent-definitions.ts ('settings'):
 * uma atribuição muda o comportamento de produção de um canal (ex.:
 * WhatsApp), não é menos sensível que a definição em si.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { z } from 'zod'

export type AgentAssignment = {
  id: string
  organization_id: string
  scenario_key: string
  agent_definition_id: string
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

async function requireAssignmentsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

export async function listAgentAssignments(orgSlug: string): Promise<{ ok: true; items: AgentAssignment[] } | { ok: false; error: string }> {
  const access = await requireAssignmentsAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { data, error } = await supabase
    .from('agent_assignments')
    .select('*')
    .eq('organization_id', access.org.id)
    .order('created_at', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, items: (data ?? []) as AgentAssignment[] }
}

const SetAssignmentInput = z.object({
  scenarioKey: z.string().trim().min(1).max(80),
  agentDefinitionId: z.string().uuid(),
  isActive: z.boolean().default(true),
})

/** Cria ou substitui a atribuição de um cenário (upsert por
 *  organization_id+scenario_key — um cenário só tem UM agente padrão por vez). */
export async function setAgentAssignment(orgSlug: string, input: unknown): Promise<{ ok: true; item: AgentAssignment } | { ok: false; error: string }> {
  const access = await requireAssignmentsAccess(orgSlug)
  if (!access.ok) return access

  const parsed = SetAssignmentInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }

  const supabase = createClient()

  // Confirma que a definição pertence a esta org antes de vincular — nunca
  // confia num id vindo do client sem essa checagem (mesmo princípio de
  // toda Server Action do projeto).
  const { data: definition } = await supabase
    .from('agent_definitions')
    .select('id')
    .eq('organization_id', access.org.id)
    .eq('id', parsed.data.agentDefinitionId)
    .maybeSingle()
  if (!definition) return { ok: false, error: 'Agent Definition não encontrado nesta organização.' }

  const { data, error } = await supabase
    .from('agent_assignments')
    .upsert(
      {
        organization_id: access.org.id,
        scenario_key: parsed.data.scenarioKey,
        agent_definition_id: parsed.data.agentDefinitionId,
        is_active: parsed.data.isActive,
        created_by: access.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,scenario_key' },
    )
    .select('*')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, item: data as AgentAssignment }
}

export async function deleteAgentAssignment(orgSlug: string, scenarioKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireAssignmentsAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { error } = await supabase
    .from('agent_assignments')
    .delete()
    .eq('organization_id', access.org.id)
    .eq('scenario_key', scenarioKey)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
