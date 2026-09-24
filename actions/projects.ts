'use server'

/**
 * Módulo Agenda → Projetos (issue #14) — CRUD de projetos/grupos.
 * Projeto é só uma camada de organização sobre Tasks: progresso e contagens
 * são sempre calculados a partir de tasks.project_id, nunca preenchidos à
 * mão. Ver supabase/migrations/0260_projetos.sql e 0267 (generalização —
 * client_id passou a ser opcional, projeto pode ser de uso interno).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { projectSchema, projectGroupSchema, type ProjectInput } from '@/lib/validators/project'
import { revalidatePath } from 'next/cache'

export type ProjectRow = {
  id: string
  client_id: string | null
  name: string
  description: string | null
  objective: string | null
  owner_id: string | null
  status: 'a_fazer' | 'em_andamento' | 'concluido'
  health: 'normal' | 'atencao' | 'bloqueado' | 'aguardando_cliente' | 'em_risco'
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  archived_at: string | null
  created_at: string
  client?: { id: string; name: string } | null
  owner?: { id: string; name: string | null; email: string | null } | null
  tasksTotal: number
  tasksDone: number
  tasksOverdue: number
}

/** Uma única query de tasks (id, status, due_date, project_id) pros projetos
 *  listados, agregada em memória — evita N+1 (uma query por card). */
async function attachTaskCounts(supabase: ReturnType<typeof createClient>, orgId: string, projects: any[]): Promise<ProjectRow[]> {
  if (projects.length === 0) return []
  const ids = projects.map(p => p.id)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('project_id, status, due_date')
    .eq('organization_id', orgId)
    .in('project_id', ids)

  const today = new Date().toISOString().split('T')[0]
  const counts = new Map<string, { total: number; done: number; overdue: number }>()
  for (const t of tasks ?? []) {
    const c = counts.get(t.project_id) ?? { total: 0, done: 0, overdue: 0 }
    c.total++
    if (t.status === 'done') c.done++
    else if (t.due_date && t.due_date.split('T')[0] < today) c.overdue++
    counts.set(t.project_id, c)
  }

  return projects.map(p => {
    const c = counts.get(p.id) ?? { total: 0, done: 0, overdue: 0 }
    return { ...p, tasksTotal: c.total, tasksDone: c.done, tasksOverdue: c.overdue }
  })
}

export async function listProjects(orgSlug: string, opts: { clientId?: string; archived?: boolean } = {}): Promise<ProjectRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  let query = supabase
    .from('projetos')
    .select('*, client:client_id(id, name)')
    .eq('organization_id', org.id)

  query = opts.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (opts.clientId) query = query.eq('client_id', opts.clientId)

  const { data, error } = await query.order('position', { ascending: true }).order('created_at', { ascending: false })
  if (error) throw new Error('Não foi possível carregar os projetos')

  return attachTaskCounts(supabase, org.id, data ?? [])
}

export async function getProject(orgSlug: string, projectId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projetos')
    .select('*, client:client_id(id, name)')
    .eq('id', projectId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (error || !data) return null
  const [withCounts] = await attachTaskCounts(supabase, org.id, [data])
  return withCounts
}

export async function listProjectGroups(orgSlug: string, projectId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projeto_grupos')
    .select('*')
    .eq('organization_id', org.id)
    .eq('project_id', projectId)
    .order('position', { ascending: true })
  if (error) throw new Error('Não foi possível carregar os grupos do projeto')
  return data ?? []
}

export async function createProject(orgSlug: string, input: ProjectInput) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const validation = projectSchema.safeParse(input)
  if (!validation.success) return { ok: false as const, error: validation.error.issues[0].message }
  const v = validation.data

  const { data, error } = await supabase.from('projetos').insert({
    organization_id: org.id,
    client_id: v.client_id || null,
    name: v.name,
    description: v.description || null,
    objective: v.objective || null,
    owner_id: v.owner_id || user.id,
    status: v.status || 'a_fazer',
    health: v.health || 'normal',
    start_date: v.start_date || null,
    due_date: v.due_date || null,
    created_by: user.id,
  }).select('id').single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  if (v.client_id) revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${v.client_id}`)
  return { ok: true as const, id: data.id as string }
}

export async function updateProject(orgSlug: string, projectId: string, input: Partial<ProjectInput>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const updates: Record<string, unknown> = {}
  if (input.client_id !== undefined) updates.client_id = input.client_id || null
  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description || null
  if (input.objective !== undefined) updates.objective = input.objective || null
  if (input.owner_id !== undefined) updates.owner_id = input.owner_id || null
  if (input.status !== undefined) updates.status = input.status
  if (input.health !== undefined) updates.health = input.health
  if (input.start_date !== undefined) updates.start_date = input.start_date || null
  if (input.due_date !== undefined) updates.due_date = input.due_date || null
  if (input.status === 'concluido') updates.completed_at = new Date().toISOString()
  if (input.status && input.status !== 'concluido') updates.completed_at = null

  const { error } = await supabase.from('projetos').update(updates).eq('id', projectId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  revalidatePath(`/app/${orgSlug}/agenda/projetos/${projectId}`)
  return { ok: true as const }
}

/** Kanban drag & drop — só o status muda. */
export async function setProjectStatus(orgSlug: string, projectId: string, status: 'a_fazer' | 'em_andamento' | 'concluido') {
  return updateProject(orgSlug, projectId, { status })
}

export async function archiveProject(orgSlug: string, projectId: string, archived: boolean) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()
  const { error } = await supabase.from('projetos')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', projectId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}

export async function deleteProject(orgSlug: string, projectId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()
  // Tasks vinculadas não são apagadas — só perdem o vínculo (ON DELETE SET NULL na FK).
  const { error } = await supabase.from('projetos').delete().eq('id', projectId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}

export async function createProjectGroup(orgSlug: string, projectId: string, name: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const validation = projectGroupSchema.safeParse({ project_id: projectId, name })
  if (!validation.success) return { ok: false as const, error: validation.error.issues[0].message }

  const { count } = await supabase.from('projeto_grupos').select('id', { count: 'exact', head: true }).eq('project_id', projectId)

  const { data, error } = await supabase.from('projeto_grupos').insert({
    organization_id: org.id,
    project_id: projectId,
    name: validation.data.name,
    position: count ?? 0,
  }).select('id').single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos/${projectId}`)
  return { ok: true as const, id: data.id as string }
}

export async function renameProjectGroup(orgSlug: string, groupId: string, name: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()
  const { error } = await supabase.from('projeto_grupos').update({ name }).eq('id', groupId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}

export async function deleteProjectGroup(orgSlug: string, groupId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()
  // Tasks do grupo não são apagadas — só voltam a ficar sem grupo (ON DELETE SET NULL).
  const { error } = await supabase.from('projeto_grupos').delete().eq('id', groupId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}
