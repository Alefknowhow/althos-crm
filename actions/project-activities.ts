'use server'

/**
 * Timeline de Agenda → Projetos (issue #17) — mesmo padrão visual/de dados
 * de contato_activities/LeadTimeline.tsx, em tabela própria (project_activities)
 * pra não mexer no trigger de contatos.last_activity_at. Cobre eventos das
 * vias de produto (UI, template aplicado) — mutations da tool genérica de IA
 * (update_projetos) ficam só em agent_audit_log, por design (ver plano da #17).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

export type ProjectActivityType =
  | 'created' | 'updated' | 'column_changed' | 'archived' | 'unarchived'
  | 'group_created' | 'group_renamed' | 'group_deleted'
  | 'task_created' | 'task_completed' | 'template_applied'

export type ProjectActivity = {
  id: string
  type: ProjectActivityType
  payload: Record<string, unknown> | null
  created_at: string
  created_by: string | null
}

export async function logProjectActivity(
  supabase: ReturnType<typeof createClient>,
  input: { organizationId: string; projectId: string; type: ProjectActivityType; payload?: Record<string, unknown>; userId?: string | null },
): Promise<void> {
  await supabase.from('project_activities').insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    type: input.type,
    payload: input.payload ?? null,
    created_by: input.userId ?? null,
  })
}

export async function listProjectActivities(orgSlug: string, projectId: string): Promise<ProjectActivity[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) throw new Error(check.reason)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('project_activities')
    .select('id, type, payload, created_at, created_by')
    .eq('organization_id', org.id)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error('Não foi possível carregar a linha do tempo do projeto')
  return (data || []) as ProjectActivity[]
}
