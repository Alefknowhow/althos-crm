'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'
import { getPlatformAiKey } from '@/lib/ai/api-key'
import {
  DEFAULT_PERSONA_PROMPT,
  DEFAULT_OUT_OF_HOURS_MESSAGE,
  DEFAULT_HANDOFF_PHRASES,
  DEFAULT_WORKING_HOURS,
} from '@/lib/ai/attendant-defaults'

/* -------- Config (per-org) -------- */

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

/* -------- Knowledge base (FAQ) -------- */

export type KnowledgeItem = {
  id: string
  category: string | null
  question: string
  answer: string
  priority: number
  is_active: boolean
  created_at: string
}

export async function listKnowledge(orgSlug: string): Promise<KnowledgeItem[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_knowledge_items')
    .select('id, category, question, answer, priority, is_active, created_at')
    .eq('organization_id', org.id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
  return (data || []) as KnowledgeItem[]
}

const knowledgeInput = z.object({
  category: z.string().optional().nullable(),
  question: z.string().min(2),
  answer: z.string().min(2),
  priority: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
})

export async function createKnowledge(orgSlug: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = knowledgeInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('ai_knowledge_items').insert({
    organization_id: org.id,
    category: parsed.data.category || null,
    question: parsed.data.question,
    answer: parsed.data.answer,
    priority: parsed.data.priority ?? 0,
    is_active: parsed.data.is_active ?? true,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/agente-ia`)
  return { ok: true as const }
}

export async function updateKnowledge(orgSlug: string, id: string, raw: unknown) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const parsed = knowledgeInput.partial().safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('ai_knowledge_items')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/agente-ia`)
  return { ok: true as const }
}

export async function deleteKnowledge(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('ai_knowledge_items')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/agente-ia`)
  return { ok: true as const }
}

/* -------- Sandbox sessions -------- */

export async function listSandboxSessions(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_sandbox_sessions')
    .select('id, title, simulated_lead, created_at, updated_at')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)
  return data || []
}

export async function createSandboxSession(orgSlug: string, simulatedLead?: any) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_sandbox_sessions')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      title: 'Conversa de teste',
      simulated_lead: simulatedLead || {
        name: 'Cliente Teste',
        phone: '+55 47 99999-0000',
      },
    })
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro' }
  return { ok: true as const, sessionId: data.id }
}

export async function deleteSandboxSession(orgSlug: string, sessionId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('ai_sandbox_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function listSandboxMessages(orgSlug: string, sessionId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_sandbox_messages')
    .select('id, role, content, tokens_input, tokens_output, cache_read_tokens, cost_cents, model, created_at')
    .eq('session_id', sessionId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })
  return data || []
}

/**
 * Send a message in a sandbox session: persists the user turn, builds the
 * full conversation context, calls the AI engine, and persists the assistant
 * reply with token/cost stats so the UI can render them inline.
 */
export async function sendSandboxMessage(
  orgSlug: string,
  sessionId: string,
  userMessage: string,
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // ── Plan gate: Atendente IA é um recurso pago (a partir do Pro) ──
  const accountId = (org as any).account_id as string | null
  if (accountId) {
    const allowed = await checkFeatureAccess(accountId, 'ai_attendant')
    if (!allowed) {
      return {
        ok: false as const,
        error: 'Atendente IA não está disponível no seu plano. Faça upgrade para liberar.',
        code: 'feature_locked' as const,
      }
    }
  }

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', org.id)
    .maybeSingle()
  // AI runs on the platform's centralized token (env), metered per account by
  // the credit gate below — no per-org API key required.
  const apiKey = getPlatformAiKey()
  if (!apiKey) {
    return {
      ok: false as const,
      error: 'IA temporariamente indisponível. Tente novamente em instantes.',
    }
  }

  // ── Credit gate: debit one attendant reply (super-admins bypass in SQL) ──
  if (accountId) {
    const credit = await consumeAiCredits({
      accountId,
      action: 'ai_attendant_reply',
      metadata: { feature: 'ai_attendant', sessionId, context: 'sandbox' },
    })
    if (!credit.success) {
      return {
        ok: false as const,
        error:
          credit.error === 'insufficient_credits'
            ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
            : 'Não foi possível validar seus créditos de IA. Tente novamente.',
        code: 'insufficient_credits' as const,
      }
    }
  }

  const config = await getAttendantConfig(orgSlug)
  const { data: knowledge } = await supabase
    .from('ai_knowledge_items')
    .select('category, question, answer, priority')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  const { data: session } = await supabase
    .from('ai_sandbox_sessions')
    .select('simulated_lead')
    .eq('id', sessionId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!session) return { ok: false as const, error: 'Sessão não encontrada' }

  const { data: prior } = await supabase
    .from('ai_sandbox_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })

  // Persist the user turn first so it remains visible even if the LLM errors.
  await supabase.from('ai_sandbox_messages').insert({
    session_id: sessionId,
    organization_id: org.id,
    role: 'user',
    content: userMessage,
  })

  const history = [
    ...((prior || []).filter(m => m.role === 'user' || m.role === 'assistant') as Array<{
      role: 'user' | 'assistant'
      content: string
    }>),
    { role: 'user' as const, content: userMessage },
  ]

  // Dynamic import keeps the Anthropic SDK lazily loaded.
  const [{ respondAsAttendant }, { ATTENDANT_TOOLS, executeAttendantTool }] = await Promise.all([
    import('@/lib/ai/attendant-engine'),
    import('@/lib/ai/attendant-tools'),
  ])

  let result
  try {
    result = await respondAsAttendant(
      {
        personaPrompt: config.persona_prompt,
        businessContext: config.business_context,
        knowledgeBase: (knowledge || []) as any,
        handoffPhrases: config.handoff_phrases,
        leadProfile: (session.simulated_lead as any) || null,
        orgName: orgData?.name || undefined,
        messages: history,
        // Give the attendant access to the CRM: list event types, check
        // availability. The executor closes over the org-scoped client.
        tools: ATTENDANT_TOOLS,
        executeTool: (name, input) =>
          executeAttendantTool(name, input, { orgId: org.id, supabase: supabase as any }),
      },
      {
        apiKey,
        model: config.model,
        maxOutputTokens: 600,
      },
    )
  } catch (e: any) {
    await supabase.from('ai_sandbox_messages').insert({
      session_id: sessionId,
      organization_id: org.id,
      role: 'system',
      content: `Erro: ${e?.message || 'falha ao chamar Claude'}`,
    })
    return { ok: false as const, error: e?.message || 'Erro ao chamar a IA' }
  }

  const { data: assistantMsg } = await supabase
    .from('ai_sandbox_messages')
    .insert({
      session_id: sessionId,
      organization_id: org.id,
      role: 'assistant',
      content: result.reply,
      tokens_input: result.usage.input_tokens || 0,
      tokens_output: result.usage.output_tokens || 0,
      cache_read_tokens: result.usage.cache_read_input_tokens || 0,
      cost_cents: result.costUsdCents,
      model: result.modelUsed,
    })
    .select('*')
    .maybeSingle()

  await supabase
    .from('ai_sandbox_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('organization_id', org.id)

  return {
    ok: true as const,
    reply: result.reply,
    handoffRequested: result.handoffRequested,
    cost_cents_usd: result.costUsdCents,
    tokens: {
      input: result.usage.input_tokens || 0,
      output: result.usage.output_tokens || 0,
      cache_read: result.usage.cache_read_input_tokens || 0,
      cache_write: result.usage.cache_creation_input_tokens || 0,
    },
    toolCalls: result.toolCalls,
    assistantMessage: assistantMsg,
  }
}
