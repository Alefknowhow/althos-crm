'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'
import { getPlatformAiKey } from '@/lib/ai/api-key'

/* -------- Sessions -------- */

export async function listInsightsSessions(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_insights_sessions')
    .select('id, title, created_at, updated_at')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)
  return data || []
}

export async function createInsightsSession(orgSlug: string, title?: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_insights_sessions')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      title: title || 'Nova conversa',
    })
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro' }
  return { ok: true as const, sessionId: data.id }
}

export async function deleteInsightsSession(orgSlug: string, sessionId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('ai_insights_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function listInsightsMessages(orgSlug: string, sessionId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_insights_messages')
    .select(
      'id, role, content, tool_calls, tokens_input, tokens_output, cache_read_tokens, cost_cents, model, created_at',
    )
    .eq('session_id', sessionId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })
  return data || []
}

/* -------- Send message (the real engine call) -------- */

export async function sendInsightMessage(
  orgSlug: string,
  sessionId: string,
  userMessage: string,
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // ── Plan gate: Insights com IA é um recurso pago (a partir do Business) ──
  const accountId = (org as any).account_id as string | null
  if (accountId) {
    const allowed = await checkFeatureAccess(accountId, 'ai_insights')
    if (!allowed) {
      return {
        ok: false as const,
        error: 'Insights com IA não está disponível no seu plano. Faça upgrade para liberar.',
        code: 'feature_locked' as const,
      }
    }
  }

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name, ai_qualifier_model')
    .eq('id', org.id)
    .maybeSingle()
  // AI runs on the platform's centralized token (env), metered per account by
  // the credit gate above — no per-org API key required.
  const apiKey = getPlatformAiKey()
  if (!apiKey) {
    return {
      ok: false as const,
      error: 'IA temporariamente indisponível. Tente novamente em instantes.',
    }
  }

  // ── Credit gate: debit one Insights query (super-admins bypass in SQL) ──
  if (accountId) {
    const credit = await consumeAiCredits({
      accountId,
      action: 'ai_insights_query',
      metadata: { feature: 'ai_insights', sessionId },
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

  // Load prior turns. Tool-call detail isn't sent back to the model — Claude
  // sees only role + text. The full tool history lives in UI state.
  const { data: prior } = await supabase
    .from('ai_insights_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })

  // Persist the user turn first so it shows up even if the LLM errors out.
  await supabase.from('ai_insights_messages').insert({
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

  // Dynamic imports keep SDK + tools out of the client bundle.
  const [{ respondAsAttendant }, { ANALYTICS_TOOLS, executeAnalyticsTool }, { ANALYST_SYSTEM_PROMPT }] =
    await Promise.all([
      import('@/lib/ai/attendant-engine'),
      import('@/lib/ai/insights-tools'),
      import('@/lib/ai/insights-prompt'),
    ])

  // Sonnet 4.6 is a sensible default for analysis (better reasoning). User
  // can override per-org via the qualifier model setting — same pool of
  // models powers all AI features for now.
  const model = orgData?.ai_qualifier_model || 'claude-sonnet-4-6'

  // Tool calls collected as we go (engine returns them too but we want raw
  // AnalyticsResult objects, not the JSON strings we sent back to Claude).
  const richToolCalls: Array<{ name: string; input: Record<string, any>; result: any }> = []

  let result
  try {
    result = await respondAsAttendant(
      {
        personaPrompt: ANALYST_SYSTEM_PROMPT,
        businessContext: '',
        knowledgeBase: [],
        handoffPhrases: [],
        leadProfile: null,
        orgName: orgData?.name || undefined,
        messages: history,
        tools: ANALYTICS_TOOLS,
        executeTool: async (name, input) => {
          const r = await executeAnalyticsTool(name, input, {
            orgId: org.id,
            supabase: supabase as any,
          })
          richToolCalls.push({ name, input, result: r })
          // JSON-encode the full AnalyticsResult so Claude sees both summary
          // and (incidentally) the view shape — but it ignores `view` since
          // it's only meaningful for the UI.
          return JSON.stringify(r)
        },
      },
      {
        apiKey,
        model,
        maxOutputTokens: 1200,
        maxIterations: 6,
      },
    )
  } catch (e: any) {
    await supabase.from('ai_insights_messages').insert({
      session_id: sessionId,
      organization_id: org.id,
      role: 'system',
      content: `Erro: ${e?.message || 'falha ao chamar Claude'}`,
    })
    return { ok: false as const, error: e?.message || 'Erro ao chamar a IA' }
  }

  // Persist assistant reply + tool_calls + cost.
  const { data: assistantMsg } = await supabase
    .from('ai_insights_messages')
    .insert({
      session_id: sessionId,
      organization_id: org.id,
      role: 'assistant',
      content: result.reply,
      tool_calls: richToolCalls,
      tokens_input: result.usage.input_tokens || 0,
      tokens_output: result.usage.output_tokens || 0,
      cache_read_tokens: result.usage.cache_read_input_tokens || 0,
      cost_cents: result.costUsdCents,
      model: result.modelUsed,
    })
    .select('*')
    .maybeSingle()

  // Touch session updated_at so it sorts to the top of the list.
  await supabase
    .from('ai_insights_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('organization_id', org.id)

  revalidatePath(`/app/${orgSlug}/insights`)

  return {
    ok: true as const,
    reply: result.reply,
    toolCalls: richToolCalls,
    cost_cents_usd: result.costUsdCents,
    tokens: {
      input: result.usage.input_tokens || 0,
      output: result.usage.output_tokens || 0,
      cache_read: result.usage.cache_read_input_tokens || 0,
      cache_write: result.usage.cache_creation_input_tokens || 0,
    },
    assistantMessage: assistantMsg,
  }
}
