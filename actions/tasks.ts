'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { taskSchema } from '@/lib/validators/task'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type TaskInput = z.infer<typeof taskSchema>

export async function createTask(orgSlug: string, input: TaskInput) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const validation = taskSchema.safeParse(input)
  if (!validation.success) {
    return { ok: false as const, error: validation.error.issues[0].message }
  }

  const { data: v } = validation

  const { error } = await supabase.from('tasks').insert({
    organization_id: org.id,
    title:       v.title,
    description: v.description || null,
    due_date:    v.due_date ? new Date(v.due_date).toISOString() : null,
    priority:    v.priority || 'normal',
    lead_id:     v.lead_id  || null,
    assigned_to: user.id,
    status: 'open',
  })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  if (v.lead_id) revalidatePath(`/app/${orgSlug}/leads/${v.lead_id}`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
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
  if (input.lead_id     !== undefined) updates.lead_id     = input.lead_id || null

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
