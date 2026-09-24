import { NextRequest } from 'next/server'
import { sanitizeChatHistory, type ChatTurn } from '@/lib/ai/chat-history'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { checkFeatureAccess, consumeAiCredits } from '@/lib/plans/server'
import { resolveAnthropicEngine } from '@/lib/ai/api-key'
import { getActiveLibraryItems, libraryItemsToKnowledgeBase } from '@/lib/ai/library'
import { buildProjectCopilotSystemPrompt } from '@/lib/ai/project-copilot-prompt'
import { resolveMemberRuntimeContext } from '@/lib/agent-definitions/context'
import { resolveAnthropicTools, buildToolExecutor } from '@/lib/agent-definitions/tools'
import { logAiExecution } from '@/lib/agent/audit'
import type { AgentContext } from '@/lib/agent/context'
import type { AgentResultEvent } from '@/lib/agent-definitions/types'

/**
 * Especialista de Projetos (issue #17 §7) — chat streaming (NDJSON) contido
 * a UM projeto (params.id), copiado-adaptado de
 * app/api/orchestrator/chat/route.ts: mesma infra de tools/auditoria/
 * créditos, mas com tools curadas (só o necessário pra Projetos/Tasks/
 * Templates) e o projeto em foco embutido no prompt — sem sessão
 * persistida, mesmo padrão stateless.
 */
export const maxDuration = 60

const PROJECT_COPILOT_TOOLS = [
  'list_projetos', 'get_projetos', 'update_projetos',
  'list_tarefas', 'get_tarefas', 'create_tarefas', 'update_tarefas',
  'list_project_templates', 'apply_project_template',
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null)
  const orgSlug = body?.orgSlug as string | undefined
  const userMessage = (body?.message as string | undefined)?.trim()
  const history = body?.history ?? []

  if (!orgSlug || !userMessage || !isValidHistory(history)) {
    return new Response(JSON.stringify({ type: 'error', error: 'Requisição inválida.' }), { status: 400 })
  }

  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const perm = await checkMemberPermission(org.id, user.id, 'projects')
  if (!perm.allowed) {
    return new Response(JSON.stringify({ type: 'error', error: perm.reason }), { status: 403 })
  }

  const { data: project, error: projErr } = await supabase
    .from('projetos')
    .select('id, name, objective, health, start_date, due_date, tags, column:column_id(name)')
    .eq('id', params.id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (projErr || !project) {
    return new Response(JSON.stringify({ type: 'error', error: 'Projeto não encontrado.' }), { status: 404 })
  }
  const { count: tasksTotal } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('project_id', params.id)
  const { count: tasksDone } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('project_id', params.id).eq('status', 'done')

  const accountId = (org as { account_id?: string | null }).account_id ?? null
  if (accountId) {
    const allowed = await checkFeatureAccess(accountId, 'ai_insights')
    if (!allowed) {
      return new Response(
        JSON.stringify({ type: 'error', code: 'feature_locked', error: 'O Especialista de Projetos não está disponível no seu plano. Faça upgrade para liberar.' }),
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
      action: 'project_copilot_chat',
      model: orgData?.ai_qualifier_model,
      metadata: { feature: 'project_copilot', orgSlug, projectId: params.id },
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
    agentLabel: 'project_copilot',
  }

  const structuredResults: AgentResultEvent[] = []
  const tools = resolveAnthropicTools(PROJECT_COPILOT_TOOLS)
  const executeToolFn = buildToolExecutor(agentCtx, structuredResults)
  const knowledgeBase = libraryItemsToKnowledgeBase(await getActiveLibraryItems(supabase, org.id))

  const chatHistory = [
    ...sanitizeChatHistory(history),
    { role: 'user' as const, content: userMessage },
  ]

  const columnRow = Array.isArray(project.column) ? project.column[0] : project.column
  const model = orgData?.ai_qualifier_model || 'claude-sonnet-4-6'
  const systemPrompt = buildProjectCopilotSystemPrompt(orgData?.name, {
    name: project.name,
    objective: project.objective,
    columnName: (columnRow as any)?.name ?? null,
    health: project.health,
    startDate: project.start_date,
    dueDate: project.due_date,
    tasksTotal: tasksTotal || 0,
    tasksDone: tasksDone || 0,
    tags: project.tags || [],
  })

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
              agentLabel: 'internal:project_copilot',
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
          agentLabel: 'internal:project_copilot',
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
