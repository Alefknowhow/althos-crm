'use server'

/**
 * Estratégia estruturada do cliente de tráfego — plano de mídia versionado
 * (media_plans) + árvore Campanha→Conjunto→Anúncio (media_plan_items).
 * Substitui o que antes era só texto solto em
 * contatos.traffic_client_profile (ver actions/traffic-client-profile.ts,
 * que continua existindo pros campos de empresa/objetivo/metas gerais —
 * este arquivo é só a parte de plano de mídia estruturado).
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type MediaPlanLevel = 'campaign' | 'adset' | 'ad'
export type MediaPlanPlatform = 'meta' | 'google' | 'tiktok' | 'linkedin' | 'gpt_ads' | 'other'
export type MediaPlanFunnelStage = 'topo' | 'meio' | 'fundo'
export type MediaPlanBudgetType = 'daily' | 'lifetime'

export type MediaPlan = {
  id: string
  name: string
  version: number
  status: 'draft' | 'approved' | 'archived'
  objective_primary: string | null
  objectives_secondary: string[] | null
  period_start: string | null
  period_end: string | null
  budget_total_cents: number | null
  target_leads: number | null
  target_cpl_cents: number | null
  target_cac_cents: number | null
  target_roas: number | null
  notes: string | null
  platform_budgets: Record<string, number>
  created_at: string
  updated_at: string
}

export type MediaPlanItem = {
  id: string
  media_plan_id: string
  parent_id: string | null
  level: MediaPlanLevel
  platform: MediaPlanPlatform
  funnel_stage: 'topo' | 'meio' | 'fundo' | null
  name: string
  objective: string | null
  status: 'planned' | 'ready' | 'published' | 'paused' | 'archived'
  budget_cents: number | null
  budget_type: 'daily' | 'lifetime' | null
  creative_id: string | null
  config: Record<string, unknown>
  order_index: number
}

const mediaPlanInput = z.object({
  name: z.string().min(2).max(200),
  objective_primary: z.string().max(200).nullable().optional(),
  objectives_secondary: z.array(z.string().max(200)).max(10).optional(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  budget_total_cents: z.number().int().min(0).nullable().optional(),
  target_leads: z.number().int().min(0).nullable().optional(),
  target_cpl_cents: z.number().int().min(0).nullable().optional(),
  target_cac_cents: z.number().int().min(0).nullable().optional(),
  target_roas: z.number().min(0).nullable().optional(),
  notes: z.string().max(3000).nullable().optional(),
  platform_budgets: z.record(z.string(), z.number().int().min(0)).optional(),
})

const mediaPlanItemInput = z.object({
  media_plan_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  level: z.enum(['campaign', 'adset', 'ad']),
  platform: z.enum(['meta', 'google', 'tiktok', 'linkedin', 'gpt_ads', 'other']),
  funnel_stage: z.enum(['topo', 'meio', 'fundo']).nullable().optional(),
  name: z.string().min(1).max(200),
  objective: z.string().max(200).nullable().optional(),
  budget_cents: z.number().int().min(0).nullable().optional(),
  budget_type: z.enum(['daily', 'lifetime']).nullable().optional(),
  creative_id: z.string().uuid().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  order_index: z.number().int().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listMediaPlans(orgSlug: string, contatoId: string): Promise<MediaPlan[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('media_plans')
    .select('*')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('version', { ascending: false })
  return (data || []) as MediaPlan[]
}

export async function getMediaPlanWithItems(orgSlug: string, planId: string): Promise<{ plan: MediaPlan; items: MediaPlanItem[] } | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const [{ data: plan }, { data: items }] = await Promise.all([
    supabase.from('media_plans').select('*').eq('id', planId).eq('organization_id', org.id).maybeSingle(),
    supabase.from('media_plan_items').select('*').eq('media_plan_id', planId).eq('organization_id', org.id).order('order_index', { ascending: true }),
  ])
  if (!plan) return null
  return { plan: plan as MediaPlan, items: (items || []) as MediaPlanItem[] }
}

export async function createMediaPlan(orgSlug: string, contatoId: string, raw: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = mediaPlanInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('media_plans')
    .select('version')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (existing?.version || 0) + 1

  const { data, error } = await supabase
    .from('media_plans')
    .insert({
      organization_id: org.id,
      contato_id: contatoId,
      version: nextVersion,
      created_by: user.id,
      ...parsed.data,
    })
    .select('id')
    .single()
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('contato_activities').insert({
    contato_id: contatoId,
    organization_id: org.id,
    type: 'traffic_media_plan_created',
    payload: { media_plan_id: data.id, name: parsed.data.name, version: nextVersion },
  })

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${contatoId}`)
  return { ok: true as const, id: data.id as string }
}

export async function updateMediaPlan(orgSlug: string, planId: string, raw: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = mediaPlanInput.partial().safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { data: plan } = await supabase.from('media_plans').select('contato_id').eq('id', planId).eq('organization_id', org.id).maybeSingle()
  if (!plan) return { ok: false as const, error: 'Plano não encontrado' }

  const { error } = await supabase.from('media_plans').update(parsed.data).eq('id', planId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('contato_activities').insert({
    contato_id: plan.contato_id,
    organization_id: org.id,
    type: 'traffic_media_plan_updated',
    payload: { media_plan_id: planId },
  })

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${plan.contato_id}`)
  return { ok: true as const }
}

export async function approveMediaPlan(orgSlug: string, planId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data: plan } = await supabase.from('media_plans').select('contato_id, name').eq('id', planId).eq('organization_id', org.id).maybeSingle()
  if (!plan) return { ok: false as const, error: 'Plano não encontrado' }

  const { error } = await supabase.from('media_plans').update({ status: 'approved' }).eq('id', planId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('contato_activities').insert({
    contato_id: plan.contato_id,
    organization_id: org.id,
    type: 'traffic_media_plan_approved',
    payload: { media_plan_id: planId, name: plan.name },
  })

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${plan.contato_id}`)
  return { ok: true as const }
}

export async function createMediaPlanItem(orgSlug: string, raw: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = mediaPlanItemInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { data: plan } = await supabase.from('media_plans').select('contato_id').eq('id', parsed.data.media_plan_id).eq('organization_id', org.id).maybeSingle()
  if (!plan) return { ok: false as const, error: 'Plano não encontrado' }

  const { data, error } = await supabase
    .from('media_plan_items')
    .insert({ organization_id: org.id, created_by: user.id, ...parsed.data })
    .select('id')
    .single()
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${plan.contato_id}`)
  return { ok: true as const, id: data.id as string }
}

export async function updateMediaPlanItem(orgSlug: string, itemId: string, raw: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = mediaPlanItemInput.partial().omit({ media_plan_id: true }).safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase.from('media_plan_items').update(parsed.data).eq('id', itemId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteMediaPlanItem(orgSlug: string, itemId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('media_plan_items').delete().eq('id', itemId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
