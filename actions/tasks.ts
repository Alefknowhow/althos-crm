'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { taskSchema } from '@/lib/validators/task'
import { isAccessBlocked } from '@/lib/billing/plans'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

export type RelatedEntityOption = { id: string; label: string }

/** Busca registros de um tipo de entidade pra popular o combobox "Relacionado
 *  a" (TaskDialog / EditSheet). Uniforme pra todos os tipos, mesmo os que
 *  internamente mapeiam pra contato_id/sale_id (contato/reserva) — mantém o
 *  componente de UI simples, sem casos especiais por tipo. */
export async function searchRelatedEntities(orgSlug: string, entityType: string, query: string): Promise<RelatedEntityOption[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const q = (query || '').trim()

  if (entityType === 'contato') {
    let sel = supabase.from('contatos').select('id, name').eq('organization_id', org.id).limit(20)
    if (q) sel = sel.ilike('name', `%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => ({ id: r.id, label: r.name }))
  }

  if (entityType === 'reserva') {
    let sel = supabase.from('travel_sales').select('id, client_name, destination, sale_number, package_locator').eq('organization_id', org.id).limit(20)
    if (q) sel = sel.or(`client_name.ilike.%${q}%,destination.ilike.%${q}%,sale_number.ilike.%${q}%,package_locator.ilike.%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => {
      const loc = r.package_locator || r.sale_number
      return {
        id: r.id,
        label: loc ? `#${loc} — ${r.client_name || r.destination || ''}` : (r.client_name || r.destination || 'Reserva'),
      }
    })
  }

  if (entityType === 'travel_proposal') {
    let sel = supabase.from('travel_proposals').select('id, title, client_name').eq('organization_id', org.id).limit(20)
    if (q) sel = sel.or(`title.ilike.%${q}%,client_name.ilike.%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => ({ id: r.id, label: [r.title, r.client_name].filter(Boolean).join(' — ') || 'Cotação' }))
  }

  if (entityType === 'appointment') {
    let sel = supabase.from('appointments').select('id, guest_name, start_time').eq('organization_id', org.id).order('start_time', { ascending: false }).limit(20)
    if (q) sel = sel.ilike('guest_name', `%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => ({
      id: r.id,
      label: `${r.guest_name || 'Agendamento'}${r.start_time ? ' — ' + new Date(r.start_time).toLocaleDateString('pt-BR') : ''}`,
    }))
  }

  if (entityType === 'sale') {
    const { data } = await supabase.from('sales').select('id, amount_cents, sale_date, contato_id').eq('organization_id', org.id).order('sale_date', { ascending: false }).limit(50)
    const rows = (data || []) as any[]
    const names = await contatoNamesFor(supabase, rows.map(r => r.contato_id))
    let out = rows.map(r => ({ id: r.id, label: `${names.get(r.contato_id) || 'Venda'} — R$ ${((r.amount_cents || 0) / 100).toFixed(2)}` }))
    if (q) out = out.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    return out.slice(0, 20)
  }

  if (entityType === 'property_deal') {
    const { data } = await supabase.from('property_deals').select('id, deal_type, contato_id').eq('organization_id', org.id).limit(50)
    const rows = (data || []) as any[]
    const names = await contatoNamesFor(supabase, rows.map(r => r.contato_id))
    let out = rows.map(r => ({ id: r.id, label: `${names.get(r.contato_id) || 'Negócio'} (${r.deal_type === 'locacao' ? 'Locação' : 'Venda'})` }))
    if (q) out = out.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    return out.slice(0, 20)
  }

  if (entityType === 'property_proposal') {
    const { data } = await supabase.from('property_proposals').select('id, operation_type, contato_id').eq('organization_id', org.id).limit(50)
    const rows = (data || []) as any[]
    const names = await contatoNamesFor(supabase, rows.map(r => r.contato_id))
    let out = rows.map(r => ({ id: r.id, label: `${names.get(r.contato_id) || 'Proposta'} (${r.operation_type === 'locacao' ? 'Locação' : 'Venda'})` }))
    if (q) out = out.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    return out.slice(0, 20)
  }

  return []
}

async function contatoNamesFor(supabase: ReturnType<typeof createClient>, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[]
  if (uniq.length === 0) return new Map()
  const { data } = await supabase.from('contatos').select('id, name').in('id', uniq)
  return new Map((data || []).map((c: any) => [c.id, c.name]))
}

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
