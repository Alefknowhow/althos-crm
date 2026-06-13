'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

/**
 * List all pipelines for an org with stage counts and lead counts — used by
 * the pipeline manager page and the kanban switcher dropdown.
 */
export async function listPipelines(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name, is_default, created_at')
    .eq('organization_id', org.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const ids = (pipelines || []).map(p => p.id)
  if (ids.length === 0) return []

  // Count stages and leads per pipeline in two grouped queries (avoid N+1).
  const [{ data: stageCounts }, { data: leadCounts }] = await Promise.all([
    supabase.from('pipeline_stages').select('pipeline_id').in('pipeline_id', ids),
    supabase.from('contatos').select('pipeline_id').in('pipeline_id', ids).eq('organization_id', org.id),
  ])

  const stageMap = new Map<string, number>()
  for (const r of stageCounts || []) stageMap.set(r.pipeline_id, (stageMap.get(r.pipeline_id) || 0) + 1)
  const leadMap = new Map<string, number>()
  for (const r of leadCounts || []) leadMap.set(r.pipeline_id, (leadMap.get(r.pipeline_id) || 0) + 1)

  return (pipelines || []).map(p => ({
    ...p,
    stage_count: stageMap.get(p.id) || 0,
    lead_count: leadMap.get(p.id) || 0,
  }))
}

export async function createPipeline(orgSlug: string, name: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const trimmed = (name || '').trim()
  if (trimmed.length < 2) return { ok: false as const, error: 'Nome muito curto' }

  // First pipeline of the org becomes default automatically.
  const { count: existing } = await supabase
    .from('pipelines')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert({
      organization_id: org.id,
      name: trimmed,
      is_default: (existing || 0) === 0,
    })
    .select('id')
    .maybeSingle()

  if (error || !pipeline) {
    console.error('createPipeline error:', error)
    return { ok: false as const, error: error?.message || 'Erro ao criar pipeline' }
  }

  // Seed with 3 sensible default stages so the user can start using it immediately.
  const seedStages = [
    { name: 'Novo', position: 1, color: '#3b82f6' },
    { name: 'Em contato', position: 2, color: '#f59e0b' },
    { name: 'Ganho', position: 3, color: '#10b981' },
  ]
  await supabase
    .from('pipeline_stages')
    .insert(seedStages.map(s => ({ ...s, pipeline_id: pipeline.id })))

  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const, pipelineId: pipeline.id }
}

export async function renamePipeline(orgSlug: string, pipelineId: string, name: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const trimmed = (name || '').trim()
  if (trimmed.length < 2) return { ok: false as const, error: 'Nome muito curto' }

  const { error } = await supabase
    .from('pipelines')
    .update({ name: trimmed })
    .eq('id', pipelineId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

/**
 * Sets a pipeline as default and clears the flag from the previous default.
 * Done in two updates because there's no atomic "swap default" — RLS makes
 * a stored procedure overkill for this scale.
 */
export async function setDefaultPipeline(orgSlug: string, pipelineId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Clear current default first.
  await supabase
    .from('pipelines')
    .update({ is_default: false })
    .eq('organization_id', org.id)
    .eq('is_default', true)

  const { error } = await supabase
    .from('pipelines')
    .update({ is_default: true })
    .eq('id', pipelineId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function deletePipeline(orgSlug: string, pipelineId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Refuse to delete the default; user must promote another pipeline first.
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id, is_default')
    .eq('id', pipelineId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!pipeline) return { ok: false as const, error: 'Pipeline não encontrado' }
  if (pipeline.is_default) {
    return { ok: false as const, error: 'Não é possível excluir o pipeline padrão. Defina outro como padrão antes.' }
  }

  // Refuse if there are leads — user has to migrate them first to avoid silent data loss.
  const { count } = await supabase
    .from('contatos')
    .select('id', { count: 'exact', head: true })
    .eq('pipeline_id', pipelineId)
    .eq('organization_id', org.id)

  if (count && count > 0) {
    return {
      ok: false as const,
      error: `Pipeline possui ${count} lead(s). Mova-os antes de excluir.`,
    }
  }

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', pipelineId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

// Used by the automations editor to populate stage dropdowns for
// "move to stage" actions. Returns stages from every pipeline of the org.
export async function getPipelinesAndStages(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('created_at')

  const pipelineIds = (pipelines || []).map(p => p.id)
  let stages: any[] = []
  if (pipelineIds.length > 0) {
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name, pipeline_id, position')
      .in('pipeline_id', pipelineIds)
      .order('position')
    stages = data || []
  }

  return { pipelines: pipelines || [], stages }
}

export async function createStage(orgSlug: string, pipelineId: string, name: string, color?: string) {
  const supabase = createClient()
  
  const { data: stages } = await supabase.from('pipeline_stages').select('position').eq('pipeline_id', pipelineId).order('position', { ascending: false }).limit(1)
  const newPosition = stages && stages.length > 0 ? stages[0].position + 1 : 1
  
  const { error } = await supabase.from('pipeline_stages').insert({
    pipeline_id: pipelineId,
    name,
    position: newPosition,
    color
  })
  
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true }
}

export async function updateStage(
  orgSlug: string,
  stageId: string,
  patch: { name?: string; is_won?: boolean; is_lost?: boolean; color?: string },
) {
  const supabase = createClient()

  // is_won and is_lost are mutually exclusive — enforce here too
  const update: Record<string, any> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.color !== undefined) update.color = patch.color
  if (patch.is_won !== undefined) {
    update.is_won = patch.is_won
    if (patch.is_won) update.is_lost = false // can't be both
  }
  if (patch.is_lost !== undefined) {
    update.is_lost = patch.is_lost
    if (patch.is_lost) update.is_won = false // can't be both
  }

  const { error } = await supabase.from('pipeline_stages').update(update).eq('id', stageId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  return { ok: true as const }
}

export async function reorderStages(orgSlug: string, stageIds: string[]) {
  const supabase = createClient()
  for (let i = 0; i < stageIds.length; i++) {
    await supabase.from('pipeline_stages').update({ position: i + 1 }).eq('id', stageIds[i])
  }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true }
}

export async function deleteStage(orgSlug: string, stageId: string) {
  const supabase = createClient()
  
  const { count } = await supabase.from('contatos').select('id', { count: 'exact' }).eq('stage_id', stageId)
  if (count && count > 0) {
    return { ok: false, error: 'Não é possível excluir um estágio que possui leads.' }
  }
  
  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true }
}
