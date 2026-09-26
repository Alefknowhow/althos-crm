import { NextRequest } from 'next/server'
import { sanitizeChatHistory, type ChatTurn } from '@/lib/ai/chat-history'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'
import { resolveAnthropicEngine } from '@/lib/ai/api-key'
import { getActiveLibraryItems, libraryItemsToKnowledgeBase } from '@/lib/ai/library'
import { buildTrafficAgentSystemPrompt } from '@/lib/ai/traffic-agent-prompt'
import { resolveMemberRuntimeContext } from '@/lib/agent-definitions/context'
import { resolveAnthropicTools, buildToolExecutor } from '@/lib/agent-definitions/tools'
import { logAiExecution } from '@/lib/agent/audit'
import type { AgentContext } from '@/lib/agent/context'
import type { AgentResultEvent } from '@/lib/agent-definitions/types'

/**
 * Traffic Agent (issue #22, passo 3.3) — chat streaming (NDJSON, mesmo
 * formato do Orquestrador Global em app/api/orchestrator/chat/route.ts),
 * escopado a UM cliente por vez (`clientId` no body) e a um subconjunto de
 * tools de tráfego/biblioteca — não expõe o restante do Agent Layer. Nunca
 * executa mutação em conta de anúncio real nesta fase (todas as tools
 * oferecidas são READ; ver lib/agent/tools/ads.ts).
 */
export const maxDuration = 60

const TRAFFIC_AGENT_TOOLS = [
  'get_clients', 'get_client', 'get_client_performance', 'get_client_targets',
  'get_campaigns', 'get_campaign_performance',
  'list_library_assets',
  'get_ad_account_insights', 'get_adsets', 'get_ads', 'get_client_alerts', 'get_search_terms', 'list_media_plan',
]

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
  const clientId = body?.clientId as string | undefined
  const userMessage = (body?.message as string | undefined)?.trim()
  const history = body?.history ?? []

  if (!orgSlug || !clientId || !userMessage || !isValidHistory(history)) {
    return new Response(JSON.stringify({ type: 'error', error: 'Requisição inválida.' }), { status: 400 })
  }

  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const perm = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!perm.allowed) {
    return new Response(JSON.stringify({ type: 'error', error: perm.reason }), { status: 403 })
  }

  const { data: client } = await supabase
    .from('contatos').select('id, name').eq('id', clientId).eq('organization_id', org.id).eq('status', 'cliente').maybeSingle()
  if (!client) {
    return new Response(JSON.stringify({ type: 'error', error: 'Cliente não encontrado.' }), { status: 404 })
  }

  const accountId = (org as { account_id?: string | null }).account_id ?? null
  if (accountId) {
    const allowed = await checkFeatureAccess(accountId, 'ai_insights')
    if (!allowed) {
      return new Response(
        JSON.stringify({ type: 'error', code: 'feature_locked', error: 'O Traffic Agent não está disponível no seu plano. Faça upgrade para liberar.' }),
        { status: 403 },
      )
    }
  }

  const { apiKey, baseURL } = await resolveAnthropicEngine()
  if (!apiKey) {
    return new Response(JSON.stringify({ type: 'error', error: 'IA temporariamente indisponível. Tente novamente em instantes.' }), { status: 503 })
  }

  const { data: orgData } = await supabase.from('organizations').select('name, ai_qualifier_model').eq('id', org.id).maybeSingle()

  if (accountId) {
    const credit = await consumeAiCredits({
      accountId,
      action: 'traffic_agent_chat',
      model: orgData?.ai_qualifier_model,
      metadata: { feature: 'traffic_agent', orgSlug, clientId },
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

  const runtimeContext = await resolveMemberRuntimeContext(orgSlug, { contactId: clientId, objective: `Analisar a operação de tráfego do cliente ${client.name}` })
  const agentCtx: AgentContext = {
    orgId: runtimeContext.orgId,
    orgSlug: runtimeContext.orgSlug,
    accountId: runtimeContext.accountId,
    niche: runtimeContext.niche,
    userId: runtimeContext.userId,
    role: runtimeContext.role,
    permissions: runtimeContext.permissions,
    agentLabel: 'traffic_agent',
  }

  const structuredResults: AgentResultEvent[] = []
  const tools = resolveAnthropicTools(TRAFFIC_AGENT_TOOLS)
  const executeToolFn = buildToolExecutor(agentCtx, structuredResults)
  // Progressive loading (issue #19): só itens da Biblioteca próprios de
  // Tráfego, não o conhecimento inteiro da org.
  const knowledgeBase = libraryItemsToKnowledgeBase(
    (await getActiveLibraryItems(supabase, org.id)).filter(i => i.source_module === 'trafego'),
  )

  const chatHistory = [
    ...sanitizeChatHistory(history),
    { role: 'user' as const, content: userMessage },
  ]

  const model = orgData?.ai_qualifier_model || 'claude-sonnet-4-6'
  const systemPrompt = buildTrafficAgentSystemPrompt(orgData?.name, client.name)

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
            businessContext: '',
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
              agentLabel: 'internal:traffic_agent',
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
          agentLabel: 'internal:traffic_agent',
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
