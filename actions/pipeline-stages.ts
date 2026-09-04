'use server'

/**
 * Pipeline stage CRUD (create/update/reorder/delete). Split out of
 * actions/pipeline.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { isAccessBlocked } from '@/lib/billing/plans'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'

/** Confirms a pipeline belongs to the org before letting a stage action touch it. */
async function assertPipelineInOrg(supabase: ReturnType<typeof createClient>, pipelineId: string, orgId: string) {
  const { data } = await supabase.from('pipelines').select('id').eq('id', pipelineId).eq('organization_id', orgId).maybeSingle()
  return !!data
}

/** Confirms a stage belongs to a pipeline of the org before letting a stage action touch it. */
async function assertStageInOrg(supabase: ReturnType<typeof createClient>, stageId: string, orgId: string) {
  const { data } = await supabase
    .from('pipeline_stages')
    .select('id, pipelines!inner(organization_id)')
    .eq('id', stageId)
    .eq('pipelines.organization_id', orgId)
    .maybeSingle()
  return !!data
}

export async function createStage(orgSlug: string, pipelineId: string, name: string, color?: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'pipeline')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  if (!(await assertPipelineInOrg(supabase, pipelineId, org.id))) {
    return { ok: false as const, error: 'Pipeline não encontrado' }
  }

  const { data: stages } = await supabase.from('pipeline_stages').select('position').eq('pipeline_id', pipelineId).order('position', { ascending: false }).limit(1)
  const newPosition = stages && stages.length > 0 ? stages[0].position + 1 : 1

  const { error } = await supabase.from('pipeline_stages').insert({
    pipeline_id: pipelineId,
    name,
    position: newPosition,
    color
  })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function updateStage(
  orgSlug: string,
  stageId: string,
  patch: { name?: string; is_won?: boolean; is_lost?: boolean; color?: string },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'pipeline')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  if (!(await assertStageInOrg(supabase, stageId, org.id))) {
    return { ok: false as const, error: 'Estágio não encontrado' }
  }

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
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'pipeline')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  for (const stageId of stageIds) {
    if (!(await assertStageInOrg(supabase, stageId, org.id))) {
      return { ok: false as const, error: 'Estágio não encontrado' }
    }
  }

  for (let i = 0; i < stageIds.length; i++) {
    await supabase.from('pipeline_stages').update({ position: i + 1 }).eq('id', stageIds[i])
  }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function deleteStage(orgSlug: string, stageId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'pipeline')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  if (!(await assertStageInOrg(supabase, stageId, org.id))) {
    return { ok: false as const, error: 'Estágio não encontrado' }
  }

  const { count } = await supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('stage_id', stageId)
  if (count && count > 0) {
    return { ok: false as const, error: 'Não é possível excluir um estágio que possui leads.' }
  }

  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}
