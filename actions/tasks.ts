'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { taskSchema } from '@/lib/validators/task'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type TaskInput = z.infer<typeof taskSchema>

/** Returns the org's first (position 0) column id, creating a default
 *  "A Fazer" column when none exists yet. Keeps every org with at least one
 *  column so the board always has somewhere to drop tasks. */
async function ensureDefaultColumnId(supabase: ReturnType<typeof createClient>, orgId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('task_columns')
    .select('id')
    .eq('organization_id', orgId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data: created } = await supabase
    .from('task_columns')
    .insert({ organization_id: orgId, name: 'A Fazer', position: 0 })
    .select('id')
    .single()
  return created?.id ?? null
}

export async function createTask(orgSlug: string, input: TaskInput) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)
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
    contato_id:     v.contato_id  || null,
    assigned_to: v.assigned_to || user.id,
    sale_id: v.sale_id || null,
    status: 'open',
    column_id: columnId,
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
}

/** Tarefas vinculadas a uma reserva específica (check-in, contatar hotel etc.). */
export async function listTasksForSale(orgSlug: string, saleId: string): Promise<SaleTaskRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date')
    .eq('organization_id', org.id)
    .eq('sale_id', saleId)
    .order('due_date', { ascending: true })
  return (data as SaleTaskRow[]) ?? []
}

export type TaskUpdateInput = Partial<TaskInput>

export async function updateTask(orgSlug: string, taskId: string, input: TaskUpdateInput) {
  const org      = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const updates: Record<string, unknown> = {}
  if (input.title       !== undefined) updates.title       = input.title
  if (input.description !== undefined) updates.description = input.description || null
  if (input.due_date    !== undefined) updates.due_date    = input.due_date ? new Date(input.due_date).toISOString() : null
  if (input.priority    !== undefined) updates.priority    = input.priority
  if (input.contato_id     !== undefined) updates.contato_id     = input.contato_id || null
  if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to || null
  if (input.sale_id !== undefined) updates.sale_id = input.sale_id || null

  const { error } = await supabase.from('tasks').update(updates).eq('id', taskId).eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

export async function deleteTask(orgSlug: string, taskId: string) {
  const org = await getCurrentOrganization(orgSlug)
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

  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId).eq('organization_id', org.id)
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

  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId).eq('organization_id', org.id)
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

// ---------------------------------------------------------------------------
// Custom kanban columns (pipeline-style, per organization)
// ---------------------------------------------------------------------------

/** Ensures the org has at least one column and returns the full ordered list. */
export async function listTaskColumns(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  await ensureDefaultColumnId(supabase, org.id)

  const { data, error } = await supabase
    .from('task_columns')
    .select('id, name, position')
    .eq('organization_id', org.id)
    .order('position', { ascending: true })

  if (error) return { ok: false as const, error: error.message, columns: [] as { id: string; name: string; position: number }[] }
  return { ok: true as const, columns: (data || []) as { id: string; name: string; position: number }[] }
}

export async function createTaskColumn(orgSlug: string, name: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const trimmed = (name || '').trim() || 'Nova coluna'

  // Append at the end: next position after the current max.
  const { data: last } = await supabase
    .from('task_columns')
    .select('position')
    .eq('organization_id', org.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPos = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('task_columns')
    .insert({ organization_id: org.id, name: trimmed, position: nextPos })
    .select('id, name, position')
    .single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const, column: data as { id: string; name: string; position: number } }
}

export async function renameTaskColumn(orgSlug: string, columnId: string, name: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const trimmed = (name || '').trim()
  if (!trimmed) return { ok: false as const, error: 'O nome não pode ficar vazio.' }

  const { error } = await supabase
    .from('task_columns')
    .update({ name: trimmed })
    .eq('id', columnId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const }
}

/** Deletes a column, moving its tasks to the first remaining column. Refuses
 *  to delete the last column so the board always keeps at least one. */
export async function deleteTaskColumn(orgSlug: string, columnId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: cols } = await supabase
    .from('task_columns')
    .select('id, position')
    .eq('organization_id', org.id)
    .order('position', { ascending: true })

  const columns = (cols || []) as { id: string; position: number }[]
  if (columns.length <= 1) {
    return { ok: false as const, error: 'Mantenha ao menos uma coluna.' }
  }

  const fallback = columns.find(c => c.id !== columnId)
  if (!fallback) return { ok: false as const, error: 'Coluna não encontrada.' }

  // Re-home the tasks before removing the column.
  const { error: moveErr } = await supabase
    .from('tasks')
    .update({ column_id: fallback.id })
    .eq('organization_id', org.id)
    .eq('column_id', columnId)
  if (moveErr) return { ok: false as const, error: moveErr.message }

  const { error } = await supabase
    .from('task_columns')
    .delete()
    .eq('id', columnId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const, fallbackColumnId: fallback.id }
}

/** Moves a task to another column (kanban drag-drop). */
export async function moveTaskToColumn(orgSlug: string, taskId: string, columnId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ column_id: columnId })
    .eq('id', taskId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const }
}
