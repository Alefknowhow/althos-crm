'use server'

import { getActionContext } from '@/lib/services/context'
import { createStageCore,deleteStageCore,updateStageCore } from '@/lib/services/pipeline-stages'

/**
 * Pipeline stage CRUD (create/update/reorder/delete). Split out of
 * actions/pipeline.ts.
 */

import { isAccessBlocked } from '@/lib/billing/plans'
import { checkMemberPermission } from '@/lib/permissions.server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization,requireAuth } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'

/** Confirms a pipeline belongs to the org before letting a stage action touch it. */


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
  return createStageCore(await getActionContext(orgSlug), pipelineId, name, color)
}

export async function updateStage(
  orgSlug: string,
  stageId: string,
  patch: { name?: string; is_won?: boolean; is_lost?: boolean; color?: string },
) {
  return updateStageCore(await getActionContext(orgSlug), stageId, patch)
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
  return deleteStageCore(await getActionContext(orgSlug), stageId)
}
