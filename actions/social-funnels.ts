'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

/**
 * CRUD dos funis de conversa em DM (Instagram). O motor (lib/social) usa o
 * admin client em runtime; aqui tudo passa por auth + permissão da org.
 */

export type FunnelStep = {
  id?: string
  sort_order: number
  step_type: 'message' | 'ai'
  message_text: string | null
  ai_instructions: string | null
  wait_for_reply: boolean
}

export type SocialFunnel = {
  id: string
  organization_id: string
  name: string
  trigger_type: 'dm' | 'comment' | 'story_reply'
  trigger_keywords: string[] | null
  create_lead: boolean
  is_active: boolean
  created_at: string
  steps: FunnelStep[]
}

const StepSchema = z.object({
  step_type: z.enum(['message', 'ai']),
  message_text: z.string().max(2000).nullable().optional(),
  ai_instructions: z.string().max(2000).nullable().optional(),
  wait_for_reply: z.boolean().default(true),
})

const FunnelPatchSchema = z.object({
  name: z.string().max(120).optional(),
  trigger_type: z.enum(['dm', 'comment', 'story_reply']).optional(),
  trigger_keywords: z.array(z.string().max(60)).max(20).nullable().optional(),
  create_lead: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

async function guard(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'social')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, org }
}

export async function getFunnels(orgSlug: string): Promise<SocialFunnel[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data: funnels } = await supabase
    .from('social_funnels')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
  if (!funnels?.length) return []

  const { data: steps } = await supabase
    .from('social_funnel_steps')
    .select('*')
    .in('funnel_id', funnels.map((f: any) => f.id))
    .order('sort_order', { ascending: true })

  const byFunnel = new Map<string, FunnelStep[]>()
  for (const s of steps || []) {
    const arr = byFunnel.get((s as any).funnel_id) || []
    arr.push(s as any)
    byFunnel.set((s as any).funnel_id, arr)
  }
  return (funnels as any[]).map(f => ({ ...f, steps: byFunnel.get(f.id) || [] }))
}

export async function createFunnel(orgSlug: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  const { data, error } = await supabase
    .from('social_funnels')
    .insert({ organization_id: g.org.id, name: 'Novo funil', trigger_type: 'dm' })
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar funil' }

  // Passo inicial de exemplo para o usuário não começar do zero.
  await supabase.from('social_funnel_steps').insert({
    funnel_id: (data as any).id, sort_order: 0, step_type: 'message',
    message_text: 'Oi! Que bom te ver por aqui 😊 Como posso te ajudar?', wait_for_reply: true,
  })

  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const, id: (data as any).id }
}

export async function updateFunnel(orgSlug: string, id: string, patch: unknown) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const parsed = FunnelPatchSchema.safeParse(patch)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos' }
  const supabase = createClient()
  const { error } = await supabase
    .from('social_funnels').update(parsed.data)
    .eq('id', id).eq('organization_id', g.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

export async function toggleFunnel(orgSlug: string, id: string, isActive: boolean) {
  return updateFunnel(orgSlug, id, { is_active: isActive })
}

export async function deleteFunnel(orgSlug: string, id: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  const { error } = await supabase
    .from('social_funnels').delete()
    .eq('id', id).eq('organization_id', g.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}

/** Substitui todos os passos do funil (lista pequena; sort_order = índice). */
export async function saveFunnelSteps(orgSlug: string, funnelId: string, steps: unknown) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const parsed = z.array(StepSchema).max(20).safeParse(steps)
  if (!parsed.success) return { ok: false as const, error: 'Passos inválidos' }

  const supabase = createClient()
  // Confere que o funil é da org antes de mexer nos filhos.
  const { data: funnel } = await supabase
    .from('social_funnels').select('id')
    .eq('id', funnelId).eq('organization_id', g.org.id).maybeSingle()
  if (!funnel) return { ok: false as const, error: 'Funil não encontrado' }

  const del = await supabase.from('social_funnel_steps').delete().eq('funnel_id', funnelId)
  if (del.error) return { ok: false as const, error: del.error.message }

  if (parsed.data.length) {
    const rows = parsed.data.map((s, i) => ({
      funnel_id: funnelId,
      sort_order: i,
      step_type: s.step_type,
      message_text: s.step_type === 'message' ? (s.message_text || null) : null,
      ai_instructions: s.step_type === 'ai' ? (s.ai_instructions || null) : null,
      wait_for_reply: s.wait_for_reply,
    }))
    const ins = await supabase.from('social_funnel_steps').insert(rows)
    if (ins.error) return { ok: false as const, error: ins.error.message }
  }
  revalidatePath(`/app/${orgSlug}/social`)
  return { ok: true as const }
}
