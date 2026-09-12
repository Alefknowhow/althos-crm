'use server'

/**
 * Distribuição automática de leads na Pipeline — atribuição por peso
 * relativo entre membros da equipe, com opção de pausar um membro, e
 * reatribuição automática quando um lead fica tempo demais no primeiro
 * estágio sem interação (ver lib/inngest/pipeline-distribution-cron.ts).
 *
 * Escrita usa admin client (bypassa RLS) porque só owner/admin pode mexer
 * na configuração — checagem manual de role aqui, igual ao resto do
 * módulo de configurações sensíveis do app.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isOrgManager } from '@/lib/permissions.server'
import { getProfilesMap } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'

export type DistributionMember = {
  user_id: string
  name: string
  email: string
  weight: number
  paused: boolean
  assigned_count: number
}

export type DistributionSettings = {
  enabled: boolean
  reassignment_enabled: boolean
}

export type ReassignmentRule = {
  id: string
  stage_id: string
  stage_name: string
  timeout_minutes: number
}

export type PipelineStageOption = { id: string; name: string }

/** Config completa (settings + membros com peso/pausa + regras de
 *  reatribuição + estágios do pipeline) pro popup de configuração. */
export async function getDistributionConfig(orgSlug: string, pipelineId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  const { data: pipeline } = await admin.from('pipelines').select('id').eq('id', pipelineId).eq('organization_id', org.id).maybeSingle()
  if (!pipeline) return { ok: false as const, error: 'Pipeline não encontrado' }

  const [{ data: settingsRow }, { data: memberships }, { data: distRows }, { data: stages }, { data: rules }] = await Promise.all([
    admin.from('pipeline_distribution_settings').select('enabled, reassignment_enabled').eq('pipeline_id', pipelineId).maybeSingle(),
    admin.from('memberships').select('user_id').eq('organization_id', org.id),
    admin.from('pipeline_distribution_members').select('user_id, weight, paused, assigned_count').eq('pipeline_id', pipelineId),
    admin.from('pipeline_stages').select('id, name').eq('pipeline_id', pipelineId).order('position'),
    admin.from('pipeline_reassignment_rules').select('id, stage_id, timeout_minutes').eq('pipeline_id', pipelineId),
  ])

  const distByUser = new Map((distRows ?? []).map(d => [d.user_id as string, d]))
  const profiles = await getProfilesMap((memberships ?? []).map((m: any) => m.user_id))
  const stageNameById = new Map((stages ?? []).map((s: any) => [s.id, s.name as string]))

  const members: DistributionMember[] = (memberships ?? []).map((m: any) => {
    const dist = distByUser.get(m.user_id)
    const p = profiles.get(m.user_id)
    return {
      user_id: m.user_id,
      name: p?.full_name || p?.email || 'Sem nome',
      email: p?.email || '',
      weight: dist?.weight ?? 1,
      paused: dist?.paused ?? false,
      assigned_count: dist?.assigned_count ?? 0,
    }
  })

  const settings: DistributionSettings = {
    enabled: settingsRow?.enabled ?? false,
    reassignment_enabled: settingsRow?.reassignment_enabled ?? false,
  }

  const reassignmentRules: ReassignmentRule[] = (rules ?? []).map((r: any) => ({
    id: r.id,
    stage_id: r.stage_id,
    stage_name: stageNameById.get(r.stage_id) || 'Estágio removido',
    timeout_minutes: r.timeout_minutes,
  }))

  const canManage = await isOrgManager(org.id, user.id)
  return {
    ok: true as const, settings, members, canManage, reassignmentRules,
    stages: (stages ?? []) as PipelineStageOption[],
  }
}

export async function updateDistributionSettings(orgSlug: string, pipelineId: string, patch: { enabled: boolean }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (!(await isOrgManager(org.id, user.id))) return { ok: false as const, error: 'Só o dono ou administradores podem configurar a distribuição.' }
  const admin = createAdminClient()

  const { data: pipeline } = await admin.from('pipelines').select('id').eq('id', pipelineId).eq('organization_id', org.id).maybeSingle()
  if (!pipeline) return { ok: false as const, error: 'Pipeline não encontrado' }

  const { error } = await admin.from('pipeline_distribution_settings').upsert({
    pipeline_id: pipelineId,
    organization_id: org.id,
    enabled: patch.enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'pipeline_id' })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

/** Toggle independente da fila — reatribuição por falta de resposta.
 *  Default false (ver migration 0225); ligar aqui não faz nada sozinho, o
 *  cron só age em pipelines com pelo menos 1 regra em pipeline_reassignment_rules. */
export async function updateReassignmentEnabled(orgSlug: string, pipelineId: string, enabled: boolean) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (!(await isOrgManager(org.id, user.id))) return { ok: false as const, error: 'Só o dono ou administradores podem configurar a distribuição.' }
  const admin = createAdminClient()

  const { data: pipeline } = await admin.from('pipelines').select('id').eq('id', pipelineId).eq('organization_id', org.id).maybeSingle()
  if (!pipeline) return { ok: false as const, error: 'Pipeline não encontrado' }

  const { error } = await admin.from('pipeline_distribution_settings').upsert({
    pipeline_id: pipelineId,
    organization_id: org.id,
    reassignment_enabled: enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'pipeline_id' })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

/** Cria ou atualiza a regra de reatribuição de um estágio (1 por estágio). */
export async function upsertReassignmentRule(orgSlug: string, pipelineId: string, stageId: string, timeoutMinutes: number) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (!(await isOrgManager(org.id, user.id))) return { ok: false as const, error: 'Só o dono ou administradores podem configurar a distribuição.' }
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) return { ok: false as const, error: 'Informe um tempo maior que zero.' }
  const admin = createAdminClient()

  const { data: stage } = await admin.from('pipeline_stages').select('id').eq('id', stageId).eq('pipeline_id', pipelineId).maybeSingle()
  if (!stage) return { ok: false as const, error: 'Estágio não encontrado neste pipeline.' }

  const { error } = await admin.from('pipeline_reassignment_rules').upsert({
    organization_id: org.id,
    pipeline_id: pipelineId,
    stage_id: stageId,
    timeout_minutes: Math.round(timeoutMinutes),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'pipeline_id,stage_id' })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function removeReassignmentRule(orgSlug: string, ruleId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (!(await isOrgManager(org.id, user.id))) return { ok: false as const, error: 'Só o dono ou administradores podem configurar a distribuição.' }
  const admin = createAdminClient()

  const { error } = await admin.from('pipeline_reassignment_rules').delete().eq('id', ruleId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function upsertDistributionMember(
  orgSlug: string, pipelineId: string, targetUserId: string, patch: { weight?: number; paused?: boolean },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (!(await isOrgManager(org.id, user.id))) return { ok: false as const, error: 'Só o dono ou administradores podem configurar a distribuição.' }
  const admin = createAdminClient()

  const { data: pipeline } = await admin.from('pipelines').select('id').eq('id', pipelineId).eq('organization_id', org.id).maybeSingle()
  if (!pipeline) return { ok: false as const, error: 'Pipeline não encontrado' }

  const { data: targetMembership } = await admin.from('memberships').select('user_id').eq('organization_id', org.id).eq('user_id', targetUserId).maybeSingle()
  if (!targetMembership) return { ok: false as const, error: 'Membro não encontrado nesta organização.' }

  const { data: existing } = await admin.from('pipeline_distribution_members').select('id, weight, paused').eq('pipeline_id', pipelineId).eq('user_id', targetUserId).maybeSingle()

  const { error } = await admin.from('pipeline_distribution_members').upsert({
    pipeline_id: pipelineId,
    organization_id: org.id,
    user_id: targetUserId,
    weight: patch.weight ?? existing?.weight ?? 1,
    paused: patch.paused ?? existing?.paused ?? false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'pipeline_id,user_id' })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

/**
 * Escolhe o próximo membro da fila por peso relativo — entre os não
 * pausados, o de menor razão assigned_count/weight (quem está mais
 * "atrasado" em relação à proporção que devia receber). Incrementa o
 * assigned_count do escolhido. Recebe o client (RLS numa action normal,
 * admin dentro do cron) pra funcionar nos dois contextos.
 *
 * Retorna null quando a distribuição está desligada pro pipeline ou não há
 * membro elegível — o caller deve usar o fallback atual (assigned_to: quem
 * criou o lead) nesse caso.
 */
export async function pickNextDistributionMember(
  supabase: any,
  orgId: string,
  pipelineId: string,
  excludeUserId?: string,
): Promise<string | null> {
  const { data: settings } = await supabase
    .from('pipeline_distribution_settings')
    .select('enabled')
    .eq('pipeline_id', pipelineId)
    .maybeSingle()
  if (!settings?.enabled) return null

  let query = supabase
    .from('pipeline_distribution_members')
    .select('id, user_id, weight, assigned_count')
    .eq('pipeline_id', pipelineId)
    .eq('organization_id', orgId)
    .eq('paused', false)
  if (excludeUserId) query = query.neq('user_id', excludeUserId)

  const { data: candidates } = await query
  if (!candidates || candidates.length === 0) return null

  let best = candidates[0]
  let bestRatio = best.assigned_count / best.weight
  for (const c of candidates.slice(1)) {
    const ratio = c.assigned_count / c.weight
    if (ratio < bestRatio || (ratio === bestRatio && c.assigned_count < best.assigned_count)) {
      best = c
      bestRatio = ratio
    }
  }

  await supabase.from('pipeline_distribution_members').update({ assigned_count: best.assigned_count + 1, updated_at: new Date().toISOString() }).eq('id', best.id)
  return best.user_id
}
