'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { taskSchema } from '@/lib/validators/task'
import { isAccessBlocked } from '@/lib/billing/plans'
import { ensureDefaultColumnId } from './tasks-columns'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type TaskInput = z.infer<typeof taskSchema>

export { searchRelatedEntities, type RelatedEntityOption } from './tasks-related-entities'
export { listTaskColumns, createTaskColumn, renameTaskColumn, deleteTaskColumn, moveTaskToColumn, ensureDefaultColumnId } from './tasks-columns'

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

  const columnId = await ensureDefaultColumnId(supabase, org.id)

  const { error } = await supabase.from('tasks').insert({
    organization_id: org.id,
    title:       v.title,
    description: v.description || null,
    due_date:    v.due_date ? new Date(v.due_date).toISOString() : null,
    priority:    v.priority || 'normal',
    assigned_to: v.assigned_to || user.id,
    status: 'open',
    column_id: columnId,
    ...relationshipUpdates(v),
  })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  if (v.contato_id) revalidatePath(`/app/${orgSlug}/contatos/${v.contato_id}`)
  if (v.sale_id) revalidatePath(`/app/${orgSlug}/reservas`)
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
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('due_date', { ascending: true })
  return data ?? []
}

export type TaskUpdateInput = Partial<TaskInput>

export async function updateTask(orgSlug: string, taskId: string, input: TaskUpdateInput) {
  const org      = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const updates: Record<string, unknown> = {}
  if (input.title       !== undefined) updates.title       = input.title
  if (input.description !== undefined) updates.description = input.description || null
  if (input.due_date    !== undefined) updates.due_date    = input.due_date ? new Date(input.due_date).toISOString() : null
  if (input.priority    !== undefined) updates.priority    = input.priority
  if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to || null
  // "Relacionado a" só é reescrito quando o form manda algum dos três campos —
  // evita zerar o vínculo existente em updates parciais que não tocam nele.
  if (input.contato_id !== undefined || input.sale_id !== undefined || input.related_entity_type !== undefined || input.related_entity_id !== undefined) {
    Object.assign(updates, relationshipUpdates(input))
  }

  const { error } = await supabase.from('tasks').update(updates).eq('id', taskId).eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

export async function deleteTask(orgSlug: string, taskId: string) {
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('organization_id', org.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true }
}

export async function toggleTaskStatus(orgSlug: string, taskId: string, status: 'open' | 'done') {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase.from('tasks')
    .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', taskId).eq('organization_id', org.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true }
}

/** Kanban-aware status setter: supports the three-state workflow
 *  (A Fazer → Em Andamento → Concluído) used by the board view. */
export async function setTaskStatus(orgSlug: string, taskId: string, status: 'open' | 'doing' | 'done') {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase.from('tasks')
    .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', taskId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

/** Quick priority change (used by the Kanban card menu). */
export async function setTaskPriority(orgSlug: string, taskId: string, priority: 'low' | 'normal' | 'high') {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase.from('tasks').update({ priority }).eq('id', taskId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}
