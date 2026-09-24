'use server'

/**
 * Agente de IA do módulo Automações — monta uma automação inteira (gatilho +
 * passos + ramificações) conversando em português, mesmo padrão stateless
 * de actions/forms-ai.ts (histórico completo mandado a cada turno pelo
 * client, sem tabela nova de sessão de chat).
 */

import { getCurrentOrganization } from '@/lib/supabase/types'
import { requireAuth } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getAccountIdForOrgSlug, consumeAiCredits } from '@/lib/plans/server'
import { visibleTriggerTypes } from '@/lib/automations/trigger-meta'
import { STEP_TYPES } from '@/components/features/automations/AutomationFlowMeta'
import { nicheKeyFor } from '@/lib/niche'
import { appendBusinessContext } from '@/lib/ai/business-context'
import { logAiExecution } from '@/lib/agent/audit'

export type AutomationAiChatTurn = { role: 'user' | 'assistant'; content: string }

export type AutomationAiStep = { id: string; type: string; config: Record<string, any> }
export type AutomationAiFlowEdge = {
  id: string
  from: string
  to: string
  condition?: { type: 'button'; buttonIndex: number } | { type: 'keyword'; operator: 'eq' | 'contains'; value: string }
}
export type AutomationAiPlan = {
  name: string
  trigger_type: string
  trigger_config: Record<string, any>
  steps: AutomationAiStep[]
  flow?: { edges: AutomationAiFlowEdge[] }
}

async function requireAutomationsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'automations')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

const STEP_TYPE_IDS = STEP_TYPES.map(t => t.id)

const PROPOSE_AUTOMATION_TOOL: any = {
  name: 'propose_automation',
  description: 'Registra o estado atual da proposta de automação — uma resposta de acompanhamento (ready=false) ou a automação finalizada (ready=true, com gatilho e passos prontos pra criar).',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'Mensagem em português pro usuário: pergunta de esclarecimento OU confirmação do que foi montado, em 1-3 frases.' },
      ready: { type: 'boolean' },
      name: { type: 'string', description: 'Nome curto da automação (só quando ready=true).' },
      trigger_type: { type: 'string', description: 'Um dos ids de gatilho listados no prompt (só quando ready=true).' },
      trigger_config: { type: 'object', description: 'Config do gatilho — ex.: {"keyword":"orçamento"} pra Instagram, {} pra "qualquer". Só quando ready=true.' },
      steps: {
        type: 'array',
        description: 'Passos em ordem (só quando ready=true).',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'slug curto único, ex.: "step_1"' },
            type: { type: 'string', enum: STEP_TYPE_IDS },
            config: { type: 'object', description: 'Campos do passo — ver referência de tipos no prompt.' },
          },
          required: ['id', 'type', 'config'],
        },
      },
      flow_edges: {
        type: 'array',
        description: 'Ramificações opcionais saindo de passos "wait_for_reply" — omitido quando o fluxo é linear.',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'id de um step do tipo wait_for_reply' },
            to: { type: 'string', description: 'id de outro step, ou "end" pra terminar o fluxo ali' },
            condition_type: { type: 'string', enum: ['keyword', 'button', 'default'] },
            keyword_operator: { type: 'string', enum: ['eq', 'contains'] },
            keyword_value: { type: 'string' },
            button_index: { type: 'number' },
          },
          required: ['from', 'to', 'condition_type'],
        },
      },
    },
    required: ['reply', 'ready'],
  },
}

function buildSystemPrompt(niche: string | null): string {
  const triggers = visibleTriggerTypes(nicheKeyFor(niche)).map(t => `- ${t.id}: ${t.label} — ${t.desc}`).join('\n')
  const steps = STEP_TYPES.map(t => `- ${t.id}: ${t.label} — ${t.desc}`).join('\n')

  return `Você monta automações de CRM (gatilho → sequência de passos) para o Althos CRM, conversando em português.

GATILHOS DISPONÍVEIS (trigger_type):
${triggers}
trigger_config normalmente fica {} (= "qualquer"); alguns aceitam filtro opcional: form.submitted → {"formId": não use, deixe vazio}; lead.stage_changed → {} (não use stageId, você não sabe os ids reais); instagram.dm.received/instagram.comment.received → {"keyword": "..."} opcional; lead.stale → {"staleDays": N}.

PASSOS DISPONÍVEIS (step type):
${steps}
Campos de config por tipo (mais comuns):
- wait: {amount, unit: "minutes"|"hours"|"days"}
- send_email: {templateId} — não invente um id, deixe "" se não souber
- send_whatsapp: {templateName} — idem, deixe "" se não souber
- create_task: {title, priority: "low"|"normal"|"high", dueInDays}
- move_stage: {} — não invente stageId
- close_deal: {dealStatus: "perdido"|"desqualificado", reason}
- add_tag: {tag}
- send_push: {title, body}
- webhook: {url, method}
- send_instagram_dm: {mode: "fixed"|"ai", message (se fixed), aiInstructions (se ai), buttons: [{type:"reply"|"link", label, value}] (até 3, opcional)}
- wait_for_reply: {} — pausa até o lead responder; ramificações vão em flow_edges, não no config
- send_sms: {message}
- start_voice_ai: {agentId, context}
- send_nps_survey: {templateName}

REGRAS:
- Se o pedido já tiver informação suficiente, monte direto (ready=true) na primeira resposta — não fique perguntando à toa. Só pergunte (ready=false) se for genuinamente vago.
- REGRA CRÍTICA: o passo "send_instagram_dm" só pode existir numa automação cujo trigger_type seja "instagram.dm.received" ou "instagram.comment.received". Nunca proponha esse passo com outro gatilho.
- Pra ramificar por resposta (ex.: "quem clicar no botão 1 vai pra X, quem clicar no botão 2 vai pra Y"), use um passo "wait_for_reply" logo depois do passo com botões, e descreva as ramificações em flow_edges: from = id do wait_for_reply, to = id do passo destino (ou "end"), condition_type "button" + button_index (0 = primeiro botão), ou "keyword" + keyword_operator + keyword_value pra texto livre, ou "default" pro caminho quando nada mais bateu.
- "id" de cada step é um slug curto único (ex.: "step_1", "step_boas_vindas").
- Depois que já propôs (ready=true) e o usuário pedir ajuste, gere a proposta COMPLETA de novo (não incremental).
- Responda SEMPRE usando a ferramenta propose_automation.`
}

export async function generateAutomationWithAi(
  orgSlug: string,
  history: AutomationAiChatTurn[],
): Promise<
  | { ok: true; reply: string; ready: boolean; plan?: AutomationAiPlan }
  | { ok: false; error: string }
> {
  const access = await requireAutomationsAccess(orgSlug)
  if (!access.ok) return access
  if (!history.length || history[history.length - 1].role !== 'user') {
    return { ok: false, error: 'Nenhuma mensagem para processar.' }
  }

  const { hasPlatformAiKey, resolveAnthropicEngine } = await import('@/lib/ai/api-key')
  if (!hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (accountId) {
    const credit = await consumeAiCredits({ accountId, action: 'automation_ai_generate', metadata: { feature: 'automations_ai', orgSlug } })
    if (!credit.success) {
      return {
        ok: false,
        error: credit.error === 'insufficient_credits'
          ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
          : 'Não foi possível validar seus créditos de IA. Tente novamente.',
      }
    }
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const { apiKey, baseURL } = await resolveAnthropicEngine()
  const client = new Anthropic({ apiKey, ...(baseURL && { baseURL }) })

  const startedAt = Date.now()
  const audit = (status: 'success' | 'error', toolInput?: unknown, error?: string) =>
    logAiExecution({
      organizationId: access.org.id,
      userId: access.user.id,
      agentLabel: 'internal:automations_ai',
      tool: 'propose_automation',
      input: toolInput,
      status,
      error,
      executionMs: Date.now() - startedAt,
    })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      system: appendBusinessContext(buildSystemPrompt((access.org as any).niche ?? null), (access.org as any).ai_business_context),
      messages: history.map(m => ({ role: m.role, content: m.content })),
      tools: [PROPOSE_AUTOMATION_TOOL],
      tool_choice: { type: 'tool', name: 'propose_automation' },
    })

    const toolBlock = response.content.find((b): b is any => b.type === 'tool_use')
    if (!toolBlock) {
      await audit('error', undefined, 'IA não retornou resposta.')
      return { ok: false, error: 'IA não retornou resposta.' }
    }

    const input = toolBlock.input as any
    await audit('success', input)
    const reply = typeof input.reply === 'string' ? input.reply : 'Certo.'
    const ready = !!input.ready
    if (!ready) return { ok: true, reply, ready: false }

    const triggerType = typeof input.trigger_type === 'string' ? input.trigger_type : ''
    const validTriggerIds = visibleTriggerTypes(nicheKeyFor((access.org as any).niche ?? null)).map(t => t.id)
    if (!validTriggerIds.includes(triggerType)) return { ok: false, error: 'IA retornou um gatilho inválido.' }

    const isInstagramTrigger = triggerType === 'instagram.dm.received' || triggerType === 'instagram.comment.received'
    const rawSteps = Array.isArray(input.steps) ? input.steps : []
    const steps: AutomationAiStep[] = rawSteps
      .filter((s: any) => s && STEP_TYPE_IDS.includes(s.type))
      // Reforça a regra no server, além do prompt — nunca confia só no que o
      // modelo prometeu seguir.
      .filter((s: any) => s.type !== 'send_instagram_dm' || isInstagramTrigger)
      .map((s: any, i: number) => ({
        id: typeof s.id === 'string' && s.id ? s.id : `step_${i}`,
        type: s.type,
        config: s.config && typeof s.config === 'object' ? s.config : {},
      }))
    if (steps.length === 0) return { ok: false, error: 'IA não retornou passos válidos.' }

    const stepIds = new Set(steps.map(s => s.id))
    const rawEdges = Array.isArray(input.flow_edges) ? input.flow_edges : []
    const edges: AutomationAiFlowEdge[] = rawEdges
      .filter((e: any) => e && stepIds.has(e.from) && (e.to === 'end' || stepIds.has(e.to)))
      .map((e: any, i: number) => {
        const condition = e.condition_type === 'button'
          ? { type: 'button' as const, buttonIndex: Number(e.button_index) || 0 }
          : e.condition_type === 'keyword'
            ? { type: 'keyword' as const, operator: (e.keyword_operator === 'eq' ? 'eq' : 'contains') as 'eq' | 'contains', value: String(e.keyword_value || '') }
            : undefined
        return { id: `edge_${i}_${Date.now()}`, from: e.from, to: e.to, condition }
      })

    return {
      ok: true,
      reply,
      ready: true,
      plan: {
        name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Automação gerada por IA',
        trigger_type: triggerType,
        trigger_config: input.trigger_config && typeof input.trigger_config === 'object' ? input.trigger_config : {},
        steps,
        flow: edges.length > 0 ? { edges } : undefined,
      },
    }
  } catch (err: any) {
    await audit('error', undefined, err?.message || 'Erro ao consultar IA.')
    return { ok: false, error: err?.message || 'Erro ao consultar IA.' }
  }
}
