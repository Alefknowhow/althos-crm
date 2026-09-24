import { NextRequest } from 'next/server'
import { sanitizeChatHistory, type ChatTurn } from '@/lib/ai/chat-history'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'
import { resolveAnthropicEngine } from '@/lib/ai/api-key'
import { getActiveLibraryItems, libraryItemsToKnowledgeBase } from '@/lib/ai/library'
import { buildOrchestratorSystemPrompt } from '@/lib/ai/orchestrator-prompt'
import { resolveMemberRuntimeContext } from '@/lib/agent-definitions/context'
import { resolveAnthropicTools, buildToolExecutor } from '@/lib/agent-definitions/tools'
import { logAiExecution } from '@/lib/agent/audit'
import { TOOL_REGISTRY } from '@/lib/agent/tools/registry'
import type { AgentContext } from '@/lib/agent/context'
import type { AgentResultEvent } from '@/lib/agent-definitions/types'

/**
 * Orquestrador Global (issue #48) — chat streaming (NDJSON, mesmo formato
 * de app/api/copilot/chat/route.ts) sem sessão persistida: o client mantém
 * o histórico da conversa enquanto o painel (Win+J / mod+j) está aberto,
 * mesmo padrão stateless de actions/forms-ai.ts / automations-ai.ts — não
 * é um "chat salvo", é um comando rápido que soma contexto durante a
 * sessão de uso.
 *
 * Oferece TODAS as tools de lib/agent/tools/registry.ts ao modelo — a
 * restrição real não é o que é oferecido, é o que executeTool() autoriza
 * por chamada (permissão de membership + capability/entitlement), com o
 * Runtime Context do usuário real logado (nunca de um token de agente
 * externo). Mesmo trade-off já aceito hoje no Agent Layer MCP, que também
 * expõe todas as tools independente do que o token específico pode usar.
 */
export const maxDuration = 60

/** Cada entrada precisa ter o shape exato que sanitizeChatHistory()/a API da
 *  Claude esperam — um item malformado (ex.: history: [null]) só seria
 *  descoberto depois de já ter cobrado o crédito, então valida aqui antes. */
function isValidHistory(history: unknown): history is ChatTurn[] {
  if (!Array.isArray(history)) return false
  return history.every(
    (m): m is ChatTurn =>
      !!m && typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' && m.content.length <= 20000,
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const orgSlug = body?.orgSlug as string | undefined
  const userMessage = (body?.message as string | undefined)?.trim()
  const history = body?.history ?? []
  const pageContext = body?.pageContext as string | undefined

  if (!orgSlug || !userMessage || !isValidHistory(history)) {
    return new Response(JSON.stringify({ type: 'error', error: 'Requisição inválida.' }), { status: 400 })
  }

  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Mesma permissão que gateia a montagem do painel em layout.tsx — o
  // painel escondido no client não é enforcement, só UX; a rota precisa
  // revalidar server-side (achado da revisão automática da PR #52).
  const perm = await checkMemberPermission(org.id, user.id, 'insights')
  if (!perm.allowed) {
    return new Response(JSON.stringify({ type: 'error', error: perm.reason }), { status: 403 })
  }

  const accountId = (org as { account_id?: string | null }).account_id ?? null
  if (accountId) {
    const allowed = await checkFeatureAccess(accountId, 'ai_insights')
    if (!allowed) {
      return new Response(
        JSON.stringify({ type: 'error', code: 'feature_locked', error: 'O Orquestrador de IA não está disponível no seu plano. Faça upgrade para liberar.' }),
        { status: 403 },
      )
    }
  }

  const { apiKey, baseURL } = await resolveAnthropicEngine()
  if (!apiKey) {
    return new Response(JSON.stringify({ type: 'error', error: 'IA temporariamente indisponível. Tente novamente em instantes.' }), { status: 503 })
  }

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name, ai_qualifier_model, ai_business_context')
    .eq('id', org.id)
    .maybeSingle()

  if (accountId) {
    const credit = await consumeAiCredits({
      accountId,
      action: 'orchestrator_chat',
      model: orgData?.ai_qualifier_model,
      metadata: { feature: 'orchestrator', orgSlug },
    })
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

  const runtimeContext = await resolveMemberRuntimeContext(orgSlug)
  const agentCtx: AgentContext = {
    orgId: runtimeContext.orgId,
    orgSlug: runtimeContext.orgSlug,
    accountId: runtimeContext.accountId,
    niche: runtimeContext.niche,
    userId: runtimeContext.userId,
    role: runtimeContext.role,
    permissions: runtimeContext.permissions,
    agentLabel: 'orchestrator',
  }

  const structuredResults: AgentResultEvent[] = []
  const tools = resolveAnthropicTools(TOOL_REGISTRY.map(({ tool }) => tool.name))
  const executeToolFn = buildToolExecutor(agentCtx, structuredResults)
  const knowledgeBase = libraryItemsToKnowledgeBase(await getActiveLibraryItems(supabase, org.id))

  const chatHistory = [
    ...sanitizeChatHistory(history),
    { role: 'user' as const, content: userMessage },
  ]

  const model = orgData?.ai_qualifier_model || 'claude-sonnet-4-6'
  const systemPrompt = buildOrchestratorSystemPrompt(orgData?.name, pageContext)

  const encoder = new TextEncoder()
  const turnStartedAt = Date.now()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      const { respondAsAttendantStream } = await import('@/lib/ai/attendant-engine')
      try {
        for await (const event of respondAsAttendantStream(
          {
            personaPrompt: systemPrompt,
            businessContext: orgData?.ai_business_context || '',
            knowledgeBase,
            handoffPhrases: [],
            leadProfile: null,
            orgName: orgData?.name || undefined,
            messages: chatHistory,
            tools,
            executeTool: executeToolFn,
          },
          { apiKey, baseURL, model, maxOutputTokens: 1200, maxIterations: 8 },
        )) {
          if (event.type === 'text_delta') {
            send({ type: 'text_delta', text: event.text })
          } else if (event.type === 'tool_call') {
            send({ type: 'tool_call', name: event.name, input: event.input, result: event.result })
          } else if (event.type === 'done') {
            await logAiExecution({
              organizationId: org.id,
              userId: user.id,
              agentLabel: 'internal:orchestrator',
              tool: 'chat_reply',
              status: 'success',
              executionMs: Date.now() - turnStartedAt,
            })
            send({ type: 'done', costCentsUsd: event.costUsdCents, structuredResults })
          }
        }
      } catch (e: any) {
        send({ type: 'error', error: e?.message || 'Erro ao chamar a IA' })
        await logAiExecution({
          organizationId: org.id,
          userId: user.id,
          agentLabel: 'internal:orchestrator',
          tool: 'chat_reply',
          status: 'error',
          error: e?.message || 'Erro ao chamar a IA',
          executionMs: Date.now() - turnStartedAt,
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
