'use server'

/**
 * Per-org AI attendant config (persona, hours, tools, etc).
 * Split out of actions/ai_attendant.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import {
  DEFAULT_PERSONA_PROMPT,
  DEFAULT_OUT_OF_HOURS_MESSAGE,
  DEFAULT_HANDOFF_PHRASES,
  DEFAULT_WORKING_HOURS,
} from '@/lib/ai/attendant-defaults'

export type AttendantConfig = {
  id: string
  organization_id: string
  is_enabled: boolean
  persona_prompt: string
  business_context: string
  primary_goal: string
  working_hours: Record<string, [number, number]>
  timezone: string
  out_of_hours_message: string
  handoff_phrases: string[]
  max_replies_per_conversation: number
  model: string
  outbound_template_name: string | null
  outbound_enabled: boolean
  // null = todas as ferramentas disponíveis habilitadas (default anterior
  // à existência da aba Ferramentas — preserva o comportamento de quem já
  // usava o agente).
  enabled_tools: string[] | null
  guided_steps: string[]
  memory_enabled: boolean
}

/**
 * Loads the config, creating a row with sensible defaults if missing. This
 * lets the settings page open without a separate "initialize" step.
 */
export async function getAttendantConfig(orgSlug: string): Promise<AttendantConfig> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // business_context e model são compartilhados com o resto da IA da org
  // (automação do Instagram, qualificador de lead) — vivem em
  // organizations, não mais em ai_attendant_config (ver migration
  // 0151_consolidate_ai_business_context). As duas colunas antigas
  // continuam no banco (não foram apagadas) só não são mais lidas.
  const [{ data }, { data: orgData }] = await Promise.all([
    supabase
      .from('ai_attendant_config')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('ai_business_context, ai_qualifier_model')
      .eq('id', org.id)
      .maybeSingle(),
  ])
  let row = data

  if (!row) {
    const { data: created } = await supabase
      .from('ai_attendant_config')
      .insert({
        organization_id: org.id,
        is_enabled: false,
        persona_prompt: DEFAULT_PERSONA_PROMPT,
        primary_goal: 'qualificar_agendar',
        working_hours: DEFAULT_WORKING_HOURS,
        out_of_hours_message: DEFAULT_OUT_OF_HOURS_MESSAGE,
        handoff_phrases: DEFAULT_HANDOFF_PHRASES,
      })
      .select('*')
      .maybeSingle()
    row = created
  }

  return {
    id: row!.id,
    organization_id: row!.organization_id,
    is_enabled: row!.is_enabled,
    persona_prompt: row!.persona_prompt || DEFAULT_PERSONA_PROMPT,
    business_context: orgData?.ai_business_context || '',
    primary_goal: row!.primary_goal || 'qualificar_agendar',
    working_hours: (row!.working_hours as any) || DEFAULT_WORKING_HOURS,
    timezone: row!.timezone || 'America/Sao_Paulo',
    out_of_hours_message: row!.out_of_hours_message || DEFAULT_OUT_OF_HOURS_MESSAGE,
    handoff_phrases: (row!.handoff_phrases as any) || DEFAULT_HANDOFF_PHRASES,
    max_replies_per_conversation: row!.max_replies_per_conversation ?? 30,
    model: orgData?.ai_qualifier_model || 'claude-haiku-4-5',
    outbound_template_name: row!.outbound_template_name,
    outbound_enabled: row!.outbound_enabled ?? false,
    enabled_tools: (row!.enabled_tools as any) ?? null,
    guided_steps: (row!.guided_steps as any) || [],
    memory_enabled: row!.memory_enabled ?? true,
  }
}

const configInput = z.object({
  is_enabled: z.boolean().optional(),
  persona_prompt: z.string().optional(),
  business_context: z.string().optional(),
  primary_goal: z.string().optional(),
  working_hours: z.record(z.string(), z.tuple([z.number(), z.number()])).optional(),
  timezone: z.string().optional(),
  out_of_hours_message: z.string().optional(),
  handoff_phrases: z.array(z.string()).optional(),
  max_replies_per_conversation: z.number().int().min(1).max(200).optional(),
  model: z.string().optional(),
  outbound_template_name: z.string().nullable().optional(),
  outbound_enabled: z.boolean().optional(),
  enabled_tools: z.array(z.string()).nullable().optional(),
  guided_steps: z.array(z.string()).optional(),
  memory_enabled: z.boolean().optional(),
})

export async function updateAttendantConfig(orgSlug: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = configInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  // Ensure a row exists first.
  await getAttendantConfig(orgSlug)

  // business_context e model são campos compartilhados com o resto da IA
  // da org (Instagram, qualificador) — gravam em organizations, não em
  // ai_attendant_config (ver getAttendantConfig acima).
  const { business_context, model, ...attendantFields } = parsed.data

  const writes: PromiseLike<{ error: { message: string } | null }>[] = []
  if (Object.keys(attendantFields).length > 0) {
    writes.push(
      supabase.from('ai_attendant_config').update(attendantFields).eq('organization_id', org.id),
    )
  }
  if (business_context !== undefined || model !== undefined) {
    const orgUpdate: Record<string, string> = {}
    if (business_context !== undefined) orgUpdate.ai_business_context = business_context
    if (model !== undefined) orgUpdate.ai_qualifier_model = model
    writes.push(supabase.from('organizations').update(orgUpdate).eq('id', org.id))
  }

  const results = await Promise.all(writes)
  const failed = results.find(r => r.error)
  if (failed?.error) return { ok: false as const, error: failed.error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/agente-ia`)
  return { ok: true as const }
}
