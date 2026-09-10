'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { VOICE_AGENT_TOOLS } from '@/lib/voice/ai-tools'

export interface VoiceAgentInput {
  name: string
  roleLabel?: string
  objective?: string
  personaPrompt?: string
  tone?: string
  model?: string
  voice?: string
  allowedTools: string[]
}

async function guardVoice(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  return { ok: true as const, user, org }
}

export async function listVoiceAgentTools() {
  return VOICE_AGENT_TOOLS.map(t => ({ name: t.name, description: t.description }))
}

export async function listVoiceAgents(orgSlug: string) {
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.', agents: [] }
  const org = await getCurrentOrganization(orgSlug) as any
  const supabase = createClient()
  const { data, error } = await supabase.from('voice_ai_agents').select('*').eq('organization_id', org.id).order('created_at')
  if (error) return { ok: false as const, error: error.message, agents: [] }
  return { ok: true as const, agents: data ?? [] }
}

export async function createVoiceAgent(orgSlug: string, input: VoiceAgentInput) {
  const guard = await guardVoice(orgSlug)
  if (!guard.ok) return guard
  const supabase = createClient()
  const { error } = await supabase.from('voice_ai_agents').insert({
    organization_id: guard.org.id,
    name: input.name,
    role_label: input.roleLabel ?? null,
    objective: input.objective ?? null,
    persona_prompt: input.personaPrompt ?? null,
    tone: input.tone ?? 'consultivo',
    model: input.model ?? 'claude-haiku-4-5',
    voice: input.voice ?? 'default',
    allowed_tools: input.allowedTools,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/voice/agentes`)
  return { ok: true as const }
}

export async function updateVoiceAgent(orgSlug: string, agentId: string, input: Partial<VoiceAgentInput> & { isActive?: boolean }) {
  const guard = await guardVoice(orgSlug)
  if (!guard.ok) return guard
  const supabase = createClient()
  const update: Record<string, unknown> = {}
  if (input.name !== undefined) update.name = input.name
  if (input.roleLabel !== undefined) update.role_label = input.roleLabel
  if (input.objective !== undefined) update.objective = input.objective
  if (input.personaPrompt !== undefined) update.persona_prompt = input.personaPrompt
  if (input.tone !== undefined) update.tone = input.tone
  if (input.model !== undefined) update.model = input.model
  if (input.voice !== undefined) update.voice = input.voice
  if (input.allowedTools !== undefined) update.allowed_tools = input.allowedTools
  if (input.isActive !== undefined) update.is_active = input.isActive

  const { error } = await supabase.from('voice_ai_agents').update(update).eq('id', agentId).eq('organization_id', guard.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/voice/agentes`)
  return { ok: true as const }
}

export async function deleteVoiceAgent(orgSlug: string, agentId: string) {
  const guard = await guardVoice(orgSlug)
  if (!guard.ok) return guard
  const supabase = createClient()
  const { error } = await supabase.from('voice_ai_agents').delete().eq('id', agentId).eq('organization_id', guard.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/voice/agentes`)
  return { ok: true as const }
}
