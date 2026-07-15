'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SocialAutomation = {
  id: string
  organization_id: string
  name: string
  trigger_type: 'dm' | 'comment' | 'dm_and_comment'
  trigger_keywords: string[] | null
  response_type: 'ai' | 'fixed'
  fixed_response: string | null
  ai_instructions: string | null
  create_lead: boolean
  send_dm_after_comment: boolean
  is_active: boolean
  created_at: string
}

export type SocialConnection = {
  id: string
  organization_id: string
  platform: 'instagram' | 'facebook'
  page_id: string
  page_name: string | null
  username: string | null
  is_active: boolean
  token_expires_at: string | null
  created_at: string
}

export type SocialInteraction = {
  id: string
  platform: string
  interaction_type: 'dm' | 'comment'
  sender_username: string | null
  sender_name: string | null
  inbound_text: string
  response_text: string | null
  response_type: string | null
  lead_created: boolean
  created_at: string
  contato_id: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrgId(orgSlug: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Organização não encontrada')
  return data.id
}

/** Escritas usam o admin client (bypassa RLS) — precisam checar auth +
 *  permissão 'social' manualmente antes de qualquer alteração. */
async function requireSocialPermission(orgSlug: string): Promise<string> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'social')
  if (!perm.allowed) throw new Error(perm.reason || 'Sem permissão')
  return org.id
}

// ── Automations CRUD ──────────────────────────────────────────────────────────

export async function getSocialAutomations(orgSlug: string): Promise<SocialAutomation[]> {
  const supabase = createClient()
  const orgId = await getOrgId(orgSlug)
  const { data, error } = await supabase
    .from('social_automations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createSocialAutomation(
  orgSlug: string,
  payload: {
    name: string
    trigger_type: 'dm' | 'comment' | 'dm_and_comment'
    trigger_keywords?: string[]
    response_type: 'ai' | 'fixed'
    fixed_response?: string
    ai_instructions?: string
    create_lead?: boolean
    send_dm_after_comment?: boolean
  },
) {
  const orgId = await requireSocialPermission(orgSlug)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('social_automations')
    .insert({
      organization_id: orgId,
      name: payload.name,
      trigger_type: payload.trigger_type,
      trigger_keywords: payload.trigger_keywords ?? null,
      response_type: payload.response_type,
      fixed_response: payload.fixed_response ?? null,
      ai_instructions: payload.ai_instructions ?? null,
      create_lead: payload.create_lead ?? true,
      send_dm_after_comment: payload.send_dm_after_comment ?? false,
    })
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)
  revalidatePath(`/app/${orgSlug}/social`)
  return data
}

export async function updateSocialAutomation(
  orgSlug: string,
  id: string,
  payload: Partial<Omit<SocialAutomation, 'id' | 'organization_id' | 'created_at'>>,
) {
  const orgId = await requireSocialPermission(orgSlug)
  const admin = createAdminClient()
  const { error } = await admin
    .from('social_automations')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/${orgSlug}/social`)
}

export async function deleteSocialAutomation(orgSlug: string, id: string) {
  const orgId = await requireSocialPermission(orgSlug)
  const admin = createAdminClient()
  const { error } = await admin
    .from('social_automations')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/${orgSlug}/social`)
}

export async function toggleSocialAutomation(orgSlug: string, id: string, isActive: boolean) {
  return updateSocialAutomation(orgSlug, id, { is_active: isActive })
}

// ── Connections ───────────────────────────────────────────────────────────────

export async function getSocialConnections(orgSlug: string): Promise<SocialConnection[]> {
  const supabase = createClient()
  const orgId = await getOrgId(orgSlug)
  const { data, error } = await supabase
    .from('social_connections')
    .select('id, organization_id, platform, page_id, page_name, username, is_active, token_expires_at, created_at')
    .eq('organization_id', orgId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function deleteSocialConnection(orgSlug: string, id: string) {
  const orgId = await requireSocialPermission(orgSlug)
  const admin = createAdminClient()
  const { error } = await admin
    .from('social_connections')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/${orgSlug}/social`)
}

// ── Interactions log ──────────────────────────────────────────────────────────

export async function getSocialInteractions(
  orgSlug: string,
  limit = 50,
): Promise<SocialInteraction[]> {
  const supabase = createClient()
  const orgId = await getOrgId(orgSlug)
  const { data, error } = await supabase
    .from('social_interactions')
    .select('id, platform, interaction_type, sender_username, sender_name, inbound_text, response_text, response_type, lead_created, created_at, contato_id')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}
