import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'
import { getPlatformAiKey } from '@/lib/ai/api-key'

/**
 * Streaming endpoint for the Financeiro AI analyst chat. Same shape as
 * app/api/copilot/chat/route.ts (NDJSON events), separate feature/table
 * (ai_financial_sessions/messages) and separate tools (financial-ai-tools.ts)
 * — notably including propor_lancamento, which never writes on its own; the
 * client calls confirmFinancialAiEntry only after the user clicks confirm.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const orgSlug = body?.orgSlug as string | undefined
  const sessionId = body?.sessionId as string | undefined
  const userMessage = (body?.message as string | undefined)?.trim()

  if (!orgSlug || !sessionId || !userMessage) {
    return new Response(JSON.stringify({ type: 'error', error: 'Requisição inválida.' }), { status: 400 })
  }

  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) {
    return new Response(JSON.stringify({ type: 'error', error: perm.reason }), { status: 403 })
  }
  const supabase = createClient()

  const accountId = (org as any).account_id as string | null
  if (accountId) {
    const allowed = await checkFeatureAccess(accountId, 'ai_insights')
    if (!allowed) {
      return new Response(
        JSON.stringify({ type: 'error', code: 'feature_locked', error: 'A IA analítica não está disponível no seu plano. Faça upgrade para liberar.' }),
        { status: 403 },
      )
    }
  }

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name, ai_qualifier_model')
    .eq('id', org.id)
    .maybeSingle()

  const apiKey = getPlatformAiKey()
  if (!apiKey) {
    return new Response(
      JSON.stringify({ type: 'error', error: 'IA temporariamente indisponível. Tente novamente em instantes.' }),
      { status: 503 },
    )
  }

  if (accountId) {
    const credit = await consumeAiCredits({ accountId, action: 'financial_ai_chat', metadata: { feature: 'financial_ai', sessionId } })
    if (!credit.success) {
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'insufficient_credits',
          error: credit.error === 'insufficient_credits'
            ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
            : 'Não foi possível validar seus créditos de IA. Tente novamente.',
        }),
        { status: 402 },
      )
    }
  }

  const { data: prior } = await supabase
    .from('ai_financial_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })

  await supabase.from('ai_financial_messages').insert({
    session_id: sessionId,
    organization_id: org.id,
    role: 'user',
    content: userMessage,
  })

  const history = [
    ...((prior || []).filter(m => m.role === 'user' || m.role === 'assistant') as Array<{ role: 'user' | 'assistant'; content: string }>),
    { role: 'user' as const, content: userMessage },
  ]

  const [{ respondAsAttendantStream }, { FINANCIAL_AI_TOOLS, executeFinancialAiTool, FINANCIAL_ANALYST_SYSTEM_PROMPT }] =
    await Promise.all([
      import('@/lib/ai/attendant-engine'),
      import('@/lib/ai/financial-ai-tools'),
    ])

  const model = orgData?.ai_qualifier_model || 'claude-sonnet-4-6'
  const richToolCalls: Array<{ name: string; input: Record<string, any>; result: any }> = []

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      let fullReply = ''
      try {
        for await (const event of respondAsAttendantStream(
          {
            personaPrompt: FINANCIAL_ANALYST_SYSTEM_PROMPT,
            businessContext: '',
            knowledgeBase: [],
            handoffPhrases: [],
            leadProfile: null,
            orgName: orgData?.name || undefined,
            messages: history,
            tools: FINANCIAL_AI_TOOLS,
            executeTool: async (name, input) => {
              const r = await executeFinancialAiTool(name, input, { orgSlug })
              richToolCalls.push({ name, input, result: r })
              return JSON.stringify(r)
            },
          },
          { apiKey, model, maxOutputTokens: 1200, maxIterations: 6 },
        )) {
          if (event.type === 'text_delta') {
            fullReply += event.text
            send({ type: 'text_delta', text: event.text })
          } else if (event.type === 'tool_call') {
            send({ type: 'tool_call', name: event.name, input: event.input, result: event.result })
          } else if (event.type === 'done') {
            const { data: assistantMsg } = await supabase
              .from('ai_financial_messages')
              .insert({
                session_id: sessionId,
                organization_id: org.id,
                role: 'assistant',
                content: event.reply || fullReply,
                tool_calls: richToolCalls,
                tokens_input: event.usage.input_tokens || 0,
                tokens_output: event.usage.output_tokens || 0,
                cache_read_tokens: event.usage.cache_read_input_tokens || 0,
                cost_cents: event.costUsdCents,
                model: event.modelUsed,
              })
              .select('id')
              .maybeSingle()

            await supabase
              .from('ai_financial_sessions')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', sessionId)
              .eq('organization_id', org.id)

            send({ type: 'done', assistantMessageId: assistantMsg?.id, costCentsUsd: event.costUsdCents })
          }
        }
      } catch (e: any) {
        send({ type: 'error', error: e?.message || 'Erro ao chamar a IA' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
