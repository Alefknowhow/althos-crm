'use server'

/**
 * AI attendant sandbox sessions/messages, and the sandbox chat turn.
 * Split out of actions/ai_attendant.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'
import { getPlatformAiKey } from '@/lib/ai/api-key'
import { getAttendantConfig } from './ai_attendant-config'

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
        guidedSteps: config.guided_steps,
        leadProfile: (session.simulated_lead as any) || null,
        orgName: orgData?.name || undefined,
        messages: history,
        // Give the attendant access to the CRM: list event types, check
        // availability. The executor closes over the org-scoped client.
        tools: config.enabled_tools ? ATTENDANT_TOOLS.filter(t => config.enabled_tools!.includes(t.name)) : ATTENDANT_TOOLS,
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
