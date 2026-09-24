'use server'

/**
 * Task CRUD + status/priority setters. Split out of actions/tasks.ts, which
 * is now a pure re-export barrel (a 'use server' file can't re-export from
 * another module, only export async functions defined directly in it).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { taskSchema } from '@/lib/validators/task'
import { isAccessBlocked } from '@/lib/billing/plans'
import { ensureDefaultColumnId } from './tasks-columns'
import { resolveTaskRelatedLabels, buildTaskRelated } from '@/lib/tasks/related-label'
import { logProjectActivity } from './project-activities'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'

export type TaskInput = z.infer<typeof taskSchema>

/** Aplica a regra "só um slot de relacionamento por vez": zera os outros dois
 *  (contato_id / sale_id / related_entity_*) sempre que um deles é setado. */
function relationshipUpdates(v: Partial<TaskInput>): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  if (v.contato_id) {
    updates.contato_id = v.contato_id
    updates.sale_id = null
    updates.related_entity_type = null
    updates.related_entity_id = null
  } else if (v.sale_id) {
    updates.sale_id = v.sale_id
    updates.contato_id = null
    updates.related_entity_type = null
    updates.related_entity_id = null
  } else if (v.related_entity_type && v.related_entity_id) {
    updates.related_entity_type = v.related_entity_type
    updates.related_entity_id = v.related_entity_id
    updates.contato_id = null
    updates.sale_id = null
  } else {
    updates.contato_id = null
    updates.sale_id = null
    updates.related_entity_type = null
    updates.related_entity_id = null
  }
  return updates
}

export async function createTask(orgSlug: string, input: TaskInput) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const validation = taskSchema.safeParse(input)
  if (!validation.success) {
    return { ok: false as const, error: validation.error.issues[0].message }
  }

  const { data: v } = validation

  // 'projects' também autoriza — Agenda → Projetos gerencia suas tasks
  // in-place (issue #17). Sem project_id, é o fluxo normal de Tarefas, que
  // exige a permissão 'tasks' de fato (achado da revisão do PR #55: o menu
  // "+ Novo" de Eventos criava tasks sem checar 'tasks' no servidor).
  const permKey = v.project_id ? 'projects' : 'tasks'
  const check = await checkMemberPermission(org.id, user.id, permKey)
  if (!check.allowed) return { ok: false as const, error: check.reason }

  const columnId = await ensureDefaultColumnId(supabase, org.id)

  const { data: created, error } = await supabase.from('tasks').insert({
    organization_id: org.id,
    title:       v.title,
    description: v.description || null,
    color:       v.color ?? 'blue',
    due_date:    v.due_date ? new Date(v.due_date).toISOString() : null,
    duration_minutes: v.duration_minutes || null,
    priority:    v.priority || 'normal',
    assigned_to: v.assigned_to || user.id,
    status: 'open',
    column_id: columnId,
    project_id: v.project_id || null,
    project_group_id: v.project_group_id || null,
    ...relationshipUpdates(v),
  }).select('id').single()

  if (error) return { ok: false as const, error: error.message }
  if (v.project_id && created) {
    await logProjectActivity(supabase, {
      organizationId: org.id, projectId: v.project_id, type: 'task_created',
      payload: { taskId: created.id, title: v.title }, userId: user.id,
    })
  }
  revalidatePath(`/app/${orgSlug}/agenda/tarefas`)
  if (v.contato_id) revalidatePath(`/app/${orgSlug}/contatos/${v.contato_id}`)
  if (v.sale_id) revalidatePath(`/app/${orgSlug}/reservas`)
  if (v.project_id) revalidatePath(`/app/${orgSlug}/agenda/projetos/${v.project_id}`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

export type SaleTaskRow = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  source_product_id: string | null
}

/** Tarefas vinculadas a uma reserva específica (check-in, contatar hotel etc.). */
export async function listTasksForSale(orgSlug: string, saleId: string): Promise<SaleTaskRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, source_product_id')
    .eq('organization_id', org.id)
    .eq('sale_id', saleId)
    .order('due_date', { ascending: true })
  return (data as SaleTaskRow[]) ?? []
}

/** Tarefas vinculadas diretamente a um lead/contato — usado pela aba
 *  "Atividades" do painel de detalhes (WhatsApp/Instagram), que vive numa
 *  rota diferente da página de Contatos e precisa buscar isso sozinho. */
export async function listTasksForContato(orgSlug: string, contatoId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('due_date', { ascending: true })
  if (error) throw new Error('Não foi possível carregar as tarefas do lead')
  return data ?? []
}

/** Tarefas vinculadas a um projeto (módulo Agenda → Projetos) — é a MESMA
 *  task do módulo global de Tarefas, só filtrada por project_id. Alias
 *  `leads` (não `contatos`) de propósito: é o nome que TasksBoardShared/
 *  EditSheet esperam pra reconhecer o vínculo com contato — usar outro
 *  nome aqui faria o "Relacionado a" abrir vazio e o Salvar apagar o
 *  contato_id existente (achado ao reaproveitar o EditSheet de Tarefas
 *  dentro de Projetos, issue #17). */
export async function listTasksForProject(orgSlug: string, projectId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*, leads:contatos(id, name)')
    .eq('organization_id', org.id)
    .eq('project_id', projectId)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw new Error('Não foi possível carregar as tarefas do projeto')
  const rows = (data ?? []) as any[]

  // `related` (reserva/cotação/agendamento/venda/negócio imobiliário) —
  // EditSheet zera o vínculo existente no Salvar se essas tasks chegarem só
  // com `leads`, sem normalizar as outras relações (achado da revisão do
  // PR #55). Mesma resolução usada pela página global de Tarefas.
  const labels = await resolveTaskRelatedLabels(supabase, rows)
  return rows.map(row => ({
    ...row,
    leads: Array.isArray(row.leads) ? (row.leads[0] ?? null) : (row.leads ?? null),
    related: buildTaskRelated(row, labels),
  }))
}

export type TaskUpdateInput = Partial<TaskInput>

export async function updateTask(orgSlug: string, taskId: string, input: TaskUpdateInput) {
  const org      = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const colorValidation = taskSchema.shape.color.safeParse(input.color)
  if (!colorValidation.success) return { ok: false as const, error: 'Cor de tarefa inválida' }
  const updates: Record<string, unknown> = {}
  if (input.color !== undefined) updates.color = colorValidation.data
  if (input.title       !== undefined) updates.title       = input.title
  if (input.description !== undefined) updates.description = input.description || null
  if (input.due_date    !== undefined) updates.due_date    = input.due_date ? new Date(input.due_date).toISOString() : null
  if (input.duration_minutes !== undefined) updates.duration_minutes = input.duration_minutes || null
  if (input.priority    !== undefined) updates.priority    = input.priority
  if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to || null
  // "Relacionado a" só é reescrito quando o form manda algum dos três campos —
  // evita zerar o vínculo existente em updates parciais que não tocam nele.
  if (input.contato_id !== undefined || input.sale_id !== undefined || input.related_entity_type !== undefined || input.related_entity_id !== undefined) {
    Object.assign(updates, relationshipUpdates(input))
  }
  // project_id/project_group_id não fazem parte do slot "Relacionado a" —
  // uma task de projeto pode continuar tendo contato_id (cliente do
  // projeto) preenchido ao mesmo tempo.
  if (input.project_id !== undefined) updates.project_id = input.project_id || null
  if (input.project_group_id !== undefined) updates.project_group_id = input.project_group_id || null

  const { error } = await supabase.from('tasks').update(updates).eq('id', taskId).eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/tarefas`)
  if (input.project_id) revalidatePath(`/app/${orgSlug}/agenda/projetos/${input.project_id}`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

export async function deleteTask(orgSlug: string, taskId: string) {
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('organization_id', org.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/agenda/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true }
}

export async function toggleTaskStatus(orgSlug: string, taskId: string, status: 'open' | 'done') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: updated, error } = await supabase.from('tasks')
    .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', taskId).eq('organization_id', org.id)
    .select('project_id, title').single()
  if (error) return { ok: false, error: error.message }

  if (status === 'done' && updated?.project_id) {
    await logProjectActivity(supabase, {
      organizationId: org.id, projectId: updated.project_id, type: 'task_completed',
      payload: { taskId, title: updated.title }, userId: user.id,
    })
  }

  revalidatePath(`/app/${orgSlug}/agenda/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true }
}

/** Kanban-aware status setter: supports the three-state workflow
 *  (A Fazer → Em Andamento → Concluído) used by the board view. */
export async function setTaskStatus(orgSlug: string, taskId: string, status: 'open' | 'doing' | 'done') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: updated, error } = await supabase.from('tasks')
    .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', taskId).eq('organization_id', org.id)
    .select('project_id, title').single()
  if (error) return { ok: false as const, error: error.message }

  if (status === 'done' && updated?.project_id) {
    await logProjectActivity(supabase, {
      organizationId: org.id, projectId: updated.project_id, type: 'task_completed',
      payload: { taskId, title: updated.title }, userId: user.id,
    })
  }

  revalidatePath(`/app/${orgSlug}/agenda/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

/** Quick priority change (used by the Kanban card menu). */
export async function setTaskPriority(orgSlug: string, taskId: string, priority: 'low' | 'normal' | 'high') {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase.from('tasks').update({ priority }).eq('id', taskId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agenda/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}
