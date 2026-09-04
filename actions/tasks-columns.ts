'use server'

/**
 * Custom kanban columns (pipeline-style, per organization) for the Tasks
 * board. Split out of actions/tasks.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

/** Returns the org's first (position 0) column id, creating a default
 *  "A Fazer" column when none exists yet. Keeps every org with at least one
 *  column so the board always has somewhere to drop tasks. */
export async function ensureDefaultColumnId(supabase: ReturnType<typeof createClient>, orgId: string): Promise<string | null> {
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
