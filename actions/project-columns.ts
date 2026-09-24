'use server'

/**
 * Etapas configuráveis do Kanban geral de Agenda → Projetos (issue #17).
 * Mesmo padrão de actions/tasks-columns.ts (task_columns), tabela própria
 * (project_columns) — ver supabase/migrations/0273_project_columns_tags_activities_templates.sql.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization, requireAuth } from '@/lib/supabase/types'
import { checkMemberPermission, isOrgManager } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type ProjectColumn = { id: string; name: string; position: number; is_done: boolean }

/** Garante ao menos 1 coluna pra org (mesmo espírito de ensureDefaultColumnId
 *  de Tasks) — cobre orgs que nunca abriram Projetos antes da #17. */
export async function ensureDefaultProjectColumnId(supabase: ReturnType<typeof createClient>, orgId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('project_columns')
    .select('id')
    .eq('organization_id', orgId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data: created } = await supabase
    .from('project_columns')
    .insert({ organization_id: orgId, name: 'A Fazer', position: 0 })
    .select('id')
    .single()
  return created?.id ?? null
}

export async function listProjectColumns(orgSlug: string): Promise<ProjectColumn[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  await ensureDefaultProjectColumnId(supabase, org.id)

  const { data, error } = await supabase
    .from('project_columns')
    .select('id, name, position, is_done')
    .eq('organization_id', org.id)
    .order('position', { ascending: true })

  if (error) throw new Error('Não foi possível carregar as etapas de Projetos')
  return (data || []) as ProjectColumn[]
}

async function requireProjectManager(orgId: string, userId: string) {
  const check = await checkMemberPermission(orgId, userId, 'projects')
  if (!check.allowed) return check
  const manager = await isOrgManager(orgId, userId)
  if (!manager) return { allowed: false as const, reason: 'Só o dono ou administradores podem gerenciar etapas do Kanban de Projetos.' }
  return { allowed: true as const }
}

export async function createProjectColumn(orgSlug: string, name: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await requireProjectManager(org.id, user.id)
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const trimmed = (name || '').trim() || 'Nova etapa'

  const { data: last } = await supabase
    .from('project_columns')
    .select('position')
    .eq('organization_id', org.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPos = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('project_columns')
    .insert({ organization_id: org.id, name: trimmed, position: nextPos })
    .select('id, name, position, is_done')
    .single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const, column: data as ProjectColumn }
}

export async function renameProjectColumn(orgSlug: string, columnId: string, name: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await requireProjectManager(org.id, user.id)
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const trimmed = (name || '').trim()
  if (!trimmed) return { ok: false as const, error: 'O nome não pode ficar vazio.' }

  const { error } = await supabase
    .from('project_columns')
    .update({ name: trimmed })
    .eq('id', columnId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}

/** Marca/desmarca a coluna como "conclui o projeto" — seta/zera
 *  projetos.completed_at quando um projeto é movido pra ela (ver setProjectColumn). */
export async function toggleProjectColumnDone(orgSlug: string, columnId: string, isDone: boolean) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await requireProjectManager(org.id, user.id)
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('project_columns')
    .update({ is_done: isDone })
    .eq('id', columnId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}

/** Apaga uma coluna, movendo seus projetos pra coluna restante (posição mais
 *  baixa). Recusa apagar a última coluna. */
export async function deleteProjectColumn(orgSlug: string, columnId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await requireProjectManager(org.id, user.id)
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const { data: cols } = await supabase
    .from('project_columns')
    .select('id, position')
    .eq('organization_id', org.id)
    .order('position', { ascending: true })

  const columns = (cols || []) as { id: string; position: number }[]
  if (columns.length <= 1) {
    return { ok: false as const, error: 'Mantenha ao menos uma etapa.' }
  }

  const fallback = columns.find(c => c.id !== columnId)
  if (!fallback) return { ok: false as const, error: 'Etapa não encontrada.' }

  const { error: moveErr } = await supabase
    .from('projetos')
    .update({ column_id: fallback.id })
    .eq('organization_id', org.id)
    .eq('column_id', columnId)
  if (moveErr) return { ok: false as const, error: moveErr.message }

  const { error } = await supabase
    .from('project_columns')
    .delete()
    .eq('id', columnId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const, fallbackColumnId: fallback.id }
}
