'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { taskSchema } from '@/lib/validators/task'
import { revalidatePath } from 'next/cache'

export async function createTask(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const rawData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    due_date: formData.get('due_date') as string,
    priority: formData.get('priority') as any,
    lead_id: formData.get('lead_id') as string,
  }

  const validation = taskSchema.safeParse(rawData)
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  const { error } = await supabase.from('tasks').insert({
    organization_id: org.id,
    title: rawData.title,
    description: rawData.description || null,
    due_date: rawData.due_date ? new Date(rawData.due_date).toISOString() : null,
    priority: rawData.priority || 'medium',
    lead_id: rawData.lead_id || null,
    assigned_to: user.id,
    status: 'open'
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  if (rawData.lead_id) revalidatePath(`/app/${orgSlug}/leads/${rawData.lead_id}`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true }
}

export async function updateTask(orgSlug: string, taskId: string, formData: FormData) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const updates: any = {}
  const title = formData.get('title')
  if (title !== null) updates.title = title
  const desc = formData.get('description')
  if (desc !== null) updates.description = desc
  const due_date = formData.get('due_date')
  if (due_date !== null) updates.due_date = due_date ? new Date(due_date as string).toISOString() : null
  const priority = formData.get('priority')
  if (priority !== null) updates.priority = priority
  const lead_id = formData.get('lead_id')
  if (lead_id !== null) updates.lead_id = lead_id || null

  const { error } = await supabase.from('tasks').update(updates).eq('id', taskId).eq('organization_id', org.id)
  
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/tarefas`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true }
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
