'use server'

/**
 * Agente de IA do módulo Formulários — duas funções independentes:
 *  1. Gera/ajusta o schema de um formulário a partir de uma conversa
 *     (generateFormWithAi + createFormFromAiSchema).
 *  2. Analisa as respostas já coletadas e devolve insights (getFormAiInsights).
 *
 * Sem tabelas novas: o histórico do chat de geração vive só no client
 * (é um fluxo pontual, não uma conversa que precisa sobreviver a um
 * refresh) — cada chamada manda o histórico completo, igual o padrão
 * stateless usado em actions/financial-entries-ai.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getAccountIdForOrgSlug, consumeAiCredits } from '@/lib/plans/server'
import { revalidatePath } from 'next/cache'
import { generateUniqueFormSlug } from './forms-slug'

const FIELD_TYPES = [
  'short_text', 'long_text', 'email', 'phone', 'number',
  'select', 'single_choice', 'multi_select', 'date', 'checkbox', 'rating', 'opinion_scale',
] as const

export type FormAiChatTurn = { role: 'user' | 'assistant'; content: string }

export type FormAiSchemaField = {
  id: string
  type: typeof FIELD_TYPES[number]
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
}

export type FormAiSchema = {
  fields: FormAiSchemaField[]
  submitButtonText?: string
  thankYouMessage?: string
  welcome?: { enabled?: boolean; title?: string; description?: string; buttonText?: string }
}

async function requireFormsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'forms')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

async function spendFormAiCredit(orgSlug: string) {
  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: true as const }
  const credit = await consumeAiCredits({ accountId, action: 'form_ai_generate', metadata: { feature: 'forms_ai', orgSlug } })
  if (!credit.success) {
    return {
      ok: false as const,
      error: credit.error === 'insufficient_credits'
        ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
        : 'Não foi possível validar seus créditos de IA. Tente novamente.',
    }
  }
  return { ok: true as const }
}

const PROPOSE_FORM_TOOL: any = {
  name: 'propose_form',
  description: 'Registra o estado atual da proposta de formulário — uma resposta de acompanhamento (ready=false, ainda reunindo requisitos) ou o formulário finalizado (ready=true, com name e schema prontos pra criar).',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'Mensagem em português pro usuário: pergunta de esclarecimento OU confirmação do que foi montado, em 1-3 frases.' },
      ready: { type: 'boolean', description: 'true quando já há campos suficientes pra criar o formulário; false se ainda está reunindo requisitos.' },
      name: { type: 'string', description: 'Nome curto do formulário (só quando ready=true).' },
      schema: {
        type: 'object',
        description: 'Schema do formulário (só quando ready=true).',
        properties: {
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'slug curto único, ex.: "field_nome"' },
                type: { type: 'string', enum: FIELD_TYPES as unknown as string[] },
                label: { type: 'string' },
                required: { type: 'boolean' },
                placeholder: { type: 'string' },
                options: { type: 'array', items: { type: 'string' }, description: 'obrigatório pra select/single_choice/multi_select' },
              },
              required: ['id', 'type', 'label'],
            },
          },
          submitButtonText: { type: 'string' },
          thankYouMessage: { type: 'string' },
          welcome: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'string' },
              description: { type: 'string' },
              buttonText: { type: 'string' },
            },
          },
        },
        required: ['fields'],
      },
    },
    required: ['reply', 'ready'],
  },
}

const FORM_AI_SYSTEM_PROMPT = `Você ajuda o usuário a montar um formulário de captação para o CRM Althos, conversando em português.

Tipos de campo disponíveis: ${FIELD_TYPES.join(', ')}.
- short_text/long_text: texto livre. email/phone: capturam contato. number/date: valores estruturados.
- select/single_choice/multi_select: escolha entre opções (sempre preencha "options"). checkbox: sim/não. rating: estrelas. opinion_scale: escala 0-10.

Regras:
- Se o pedido do usuário já tiver informação suficiente pra montar um formulário útil, monte direto (ready=true) já na primeira resposta — não fique fazendo perguntas desnecessárias.
- Só pergunte (ready=false) se o pedido for genuinamente vago (ex.: "faz um formulário" sem contexto nenhum).
- Sempre inclua pelo menos um campo de contato (nome e telefone ou e-mail), a menos que o usuário peça explicitamente o contrário.
- Nomes de campo (label) claros e curtos, em português.
- "id" de cada campo é um slug curto único (ex.: "field_nome", "field_destino").
- Depois que já propôs um formulário (ready=true) e o usuário pedir um ajuste, gere o schema COMPLETO de novo (não incremental), aplicando o ajuste.
- Responda SEMPRE usando a ferramenta propose_form.`

/** Gera ou ajusta a proposta de formulário a partir do histórico completo
 *  da conversa (stateless — o client manda o histórico a cada turno). */
export async function generateFormWithAi(
  orgSlug: string,
  history: FormAiChatTurn[],
): Promise<
  | { ok: true; reply: string; ready: boolean; name?: string; schema?: FormAiSchema }
  | { ok: false; error: string }
> {
  const access = await requireFormsAccess(orgSlug)
  if (!access.ok) return access
  if (!history.length || history[history.length - 1].role !== 'user') {
    return { ok: false, error: 'Nenhuma mensagem para processar.' }
  }

  const { hasPlatformAiKey, resolveAnthropicEngine } = await import('@/lib/ai/api-key')
  if (!hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  const credit = await spendFormAiCredit(orgSlug)
  if (!credit.ok) return credit

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const { apiKey, baseURL } = await resolveAnthropicEngine()
  const client = new Anthropic({ apiKey, ...(baseURL && { baseURL }) })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      system: FORM_AI_SYSTEM_PROMPT,
      messages: history.map(m => ({ role: m.role, content: m.content })),
      tools: [PROPOSE_FORM_TOOL],
      tool_choice: { type: 'tool', name: 'propose_form' },
    })

    const toolBlock = response.content.find((b): b is any => b.type === 'tool_use')
    if (!toolBlock) return { ok: false, error: 'IA não retornou resposta.' }

    const input = toolBlock.input as any
    const reply = typeof input.reply === 'string' ? input.reply : 'Certo.'
    const ready = !!input.ready
    if (!ready) return { ok: true, reply, ready: false }

    const rawFields = Array.isArray(input.schema?.fields) ? input.schema.fields : []
    const fields: FormAiSchemaField[] = rawFields
      .filter((f: any) => f && typeof f.label === 'string' && FIELD_TYPES.includes(f.type))
      .map((f: any, i: number) => ({
        id: typeof f.id === 'string' && f.id ? f.id : `field_${i}`,
        type: f.type,
        label: f.label,
        required: !!f.required,
        placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
        options: Array.isArray(f.options) ? f.options.filter((o: any) => typeof o === 'string') : undefined,
      }))
    if (fields.length === 0) return { ok: false, error: 'IA não retornou campos válidos.' }

    return {
      ok: true,
      reply,
      ready: true,
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Formulário gerado por IA',
      schema: {
        fields,
        submitButtonText: typeof input.schema?.submitButtonText === 'string' ? input.schema.submitButtonText : undefined,
        thankYouMessage: typeof input.schema?.thankYouMessage === 'string' ? input.schema.thankYouMessage : undefined,
        welcome: input.schema?.welcome && typeof input.schema.welcome === 'object' ? input.schema.welcome : undefined,
      },
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao consultar IA.' }
  }
}

/** Cria o formulário de verdade a partir do schema aprovado pelo usuário no chat. */
export async function createFormFromAiSchema(orgSlug: string, name: string, schema: FormAiSchema) {
  const access = await requireFormsAccess(orgSlug)
  if (!access.ok) return access
  const { org } = access

  const supabase = createClient()
  const slug = await generateUniqueFormSlug(name)

  const { data: pipeline } = await supabase
    .from('pipelines').select('id')
    .eq('organization_id', org.id).eq('is_default', true)
    .maybeSingle()

  let stageId: string | null = null
  if (pipeline) {
    const { data: stage } = await supabase
      .from('pipeline_stages').select('id')
      .eq('pipeline_id', pipeline.id)
      .order('position').limit(1).maybeSingle()
    if (stage) stageId = stage.id
  }

  const { data: form, error } = await supabase.from('forms').insert({
    organization_id: org.id,
    name,
    slug,
    schema: {
      fields: schema.fields,
      submitButtonText: schema.submitButtonText || 'Enviar',
      thankYouMessage: schema.thankYouMessage || 'Obrigado! Recebemos suas informações.',
      ...(schema.welcome ? { welcome: schema.welcome } : {}),
    },
    pipeline_id: pipeline?.id ?? null,
    stage_id: stageId,
    is_active: true,
  }).select().single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao criar formulário' }
  revalidatePath(`/app/${orgSlug}/forms`)
  return { ok: true as const, form }
}
