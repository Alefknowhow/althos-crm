/**
 * Conversational AI engine for the WhatsApp attendant.
 *
 * Pure function: takes config + message history + lead context + a tool
 * executor callback, calls Claude with prompt caching + tool use enabled,
 * loops through any tool_use turns, and returns the final assistant reply
 * plus an audit trail of tool calls and accumulated usage.
 *
 * No DB access, no Inngest knowledge, no WhatsApp knowledge — the tool
 * executor is provided by the caller (sandbox uses real DB; future WhatsApp
 * webhook will use the same engine with the same executor).
 */

import Anthropic from '@anthropic-ai/sdk'

export type AttendantTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type AttendantInput = {
  // Stable per-org context — gets cached.
  personaPrompt: string
  businessContext?: string | null
  knowledgeBase?: Array<{ category?: string | null; question: string; answer: string }>
  handoffPhrases?: string[]

  // Per-conversation context.
  leadProfile?: {
    name?: string | null
    phone?: string | null
    email?: string | null
    source?: string | null
    tags?: string[] | null
    custom_fields?: Record<string, any> | null
  } | null
  orgName?: string

  // Message history (oldest → newest). The new user message MUST already be
  // appended by the caller. The engine sends this verbatim to Claude.
  messages: AttendantTurn[]

  // Tools Claude can call. Pass [] (or omit) to disable tool use.
  tools?: Anthropic.Messages.Tool[]

  // Executor: server-side dispatcher that takes a tool name + input and
  // returns the textual result Claude will read. Required if tools is set.
  executeTool?: (name: string, input: Record<string, any>) => Promise<string>
}

export type AttendantConfig = {
  apiKey: string
  model: string
  maxOutputTokens?: number
  // Hard ceiling on tool-use iterations. Beyond this we force end_turn to
  // avoid an AI getting stuck in a loop and burning budget.
  maxIterations?: number
}

export type ToolCallRecord = {
  name: string
  input: Record<string, any>
  output: string
}

export type AggregatedUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type AttendantResult = {
  reply: string
  toolCalls: ToolCallRecord[]
  usage: AggregatedUsage
  costUsdCents: number
  modelUsed: string
  handoffRequested: boolean
}

const PRICING_PER_M_TOKENS: Record<
  string,
  { input: number; output: number; cache_write: number; cache_read: number }
> = {
  'claude-haiku-4-5': { input: 1, output: 5, cache_write: 1.25, cache_read: 0.1 },
  'claude-sonnet-4-6': { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  'claude-opus-4-7': { input: 5, output: 25, cache_write: 6.25, cache_read: 0.5 },
}

function computeCostUsdCents(model: string, usage: AggregatedUsage): number {
  const p = PRICING_PER_M_TOKENS[model] || PRICING_PER_M_TOKENS['claude-haiku-4-5']
  const inputCents = (usage.input_tokens / 1_000_000) * p.input * 100
  const outputCents = (usage.output_tokens / 1_000_000) * p.output * 100
  const cacheWriteCents = (usage.cache_creation_input_tokens / 1_000_000) * p.cache_write * 100
  const cacheReadCents = (usage.cache_read_input_tokens / 1_000_000) * p.cache_read * 100
  return Math.round(inputCents + outputCents + cacheWriteCents + cacheReadCents)
}

function accumulateUsage(acc: AggregatedUsage, u: Anthropic.Messages.Usage): void {
  acc.input_tokens += u.input_tokens || 0
  acc.output_tokens += u.output_tokens || 0
  acc.cache_read_input_tokens += u.cache_read_input_tokens || 0
  acc.cache_creation_input_tokens += u.cache_creation_input_tokens || 0
}

function buildSystemBlocks(input: AttendantInput): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = []

  const personaText = input.personaPrompt.replace(
    /\{\{org_nome\}\}/g,
    input.orgName || 'nossa empresa',
  )
  blocks.push({ type: 'text', text: personaText })

  if (input.businessContext && input.businessContext.trim()) {
    blocks.push({
      type: 'text',
      text: `\n\n# Contexto do negócio\n${input.businessContext.trim()}`,
    })
  }

  if (input.knowledgeBase && input.knowledgeBase.length > 0) {
    const grouped = new Map<string, Array<{ question: string; answer: string }>>()
    for (const item of input.knowledgeBase) {
      const cat = item.category || 'Geral'
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push({ question: item.question, answer: item.answer })
    }
    const kbLines: string[] = [
      '\n\n# Base de conhecimento (FAQ)\nUse APENAS as informações abaixo para responder sobre o negócio. Se faltar algo, diga "vou verificar com a equipe e te retorno":\n',
    ]
    for (const [cat, items] of Array.from(grouped.entries())) {
      kbLines.push(`\n## ${cat}`)
      for (const it of items) {
        kbLines.push(`- **${it.question}**: ${it.answer}`)
      }
    }
    blocks.push({ type: 'text', text: kbLines.join('\n') })
  }

  if (input.handoffPhrases && input.handoffPhrases.length > 0) {
    blocks.push({
      type: 'text',
      text:
        '\n\n# Quando passar para humano\nSe a pessoa mencionar qualquer um destes termos, encerre suavemente e diga que vai chamar um atendente: ' +
        input.handoffPhrases.join(', '),
    })
  }

  // Tool use guidance — only when tools are wired. Helps the model decide.
  if (input.tools && input.tools.length > 0) {
    blocks.push({
      type: 'text',
      text:
        '\n\n# Ferramentas disponíveis\nVocê tem acesso a ferramentas que consultam o sistema da empresa em tempo real. SEMPRE use-as quando precisar de informação atual (disponibilidade de horários, serviços oferecidos, etc) em vez de inventar dados. Use português brasileiro nos resultados quando reescrever para o cliente.',
    })
  }

  // Cache marker on the last stable block — everything above (persona,
  // context, KB, handoff, tool guidance) is reused across all messages of
  // every conversation in this org.
  if (blocks.length > 0) {
    blocks[blocks.length - 1] = {
      ...blocks[blocks.length - 1],
      cache_control: { type: 'ephemeral' },
    }
  }

  // Lead profile (volatile, per-conversation) comes after the cache mark.
  if (input.leadProfile) {
    const p = input.leadProfile
    const profileLines = ['\n\n# Sobre o cliente nesta conversa']
    if (p.name) profileLines.push(`- Nome: ${p.name}`)
    if (p.phone) profileLines.push(`- Telefone: ${p.phone}`)
    if (p.email) profileLines.push(`- E-mail: ${p.email}`)
    if (p.source) profileLines.push(`- Origem: ${p.source}`)
    if (p.tags && p.tags.length) profileLines.push(`- Tags: ${p.tags.join(', ')}`)
    if (p.custom_fields && Object.keys(p.custom_fields).length > 0) {
      profileLines.push('- Respostas anteriores:')
      for (const [k, v] of Object.entries(p.custom_fields)) {
        const value = Array.isArray(v) ? v.join(', ') : String(v)
        profileLines.push(`  - ${k}: ${value}`)
      }
    }
    blocks.push({ type: 'text', text: profileLines.join('\n') })
  }

  return blocks
}

function detectHandoff(messages: AttendantTurn[], phrases: string[]): boolean {
  const last = [...messages].reverse().find(m => m.role === 'user')
  if (!last) return false
  const text = last.content.toLowerCase()
  return phrases.some(p => text.includes(p.toLowerCase()))
}

export async function respondAsAttendant(
  input: AttendantInput,
  config: AttendantConfig,
): Promise<AttendantResult> {
  const client = new Anthropic({ apiKey: config.apiKey })

  const handoffRequested = detectHandoff(input.messages, input.handoffPhrases || [])

  const systemBlocks = buildSystemBlocks(input)
  const model = config.model || 'claude-haiku-4-5'
  const maxIterations = config.maxIterations ?? 5
  const hasTools = (input.tools?.length ?? 0) > 0 && !!input.executeTool

  // Initialize the messages array with the incoming user/assistant history.
  // We'll append assistant tool_use turns and user tool_result turns as the
  // loop progresses.
  const messages: Anthropic.Messages.MessageParam[] = input.messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  const toolCalls: ToolCallRecord[] = []
  const usage: AggregatedUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }

  let finalReply = ''
  let modelUsed = model

  for (let iter = 0; iter < maxIterations; iter++) {
    const response = await client.messages.create({
      model,
      max_tokens: config.maxOutputTokens ?? 600,
      system: systemBlocks,
      messages,
      ...(hasTools && { tools: input.tools }),
    })

    accumulateUsage(usage, response.usage)
    modelUsed = response.model

    if (response.stop_reason !== 'tool_use') {
      // Done — extract the assistant's text reply.
      const textBlock = response.content.find(b => b.type === 'text') as
        | Anthropic.Messages.TextBlock
        | undefined
      finalReply = textBlock?.text || ''
      break
    }

    // Tool use turn. We need to:
    //   1) Append the assistant message (including tool_use blocks) to history
    //   2) Execute each tool_use block via the caller's executor
    //   3) Append a user message with tool_result blocks for each call
    //   4) Loop and call Claude again
    messages.push({ role: 'assistant', content: response.content })

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    )

    const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const tu of toolUseBlocks) {
      const result = input.executeTool
        ? await input.executeTool(tu.name, (tu.input as Record<string, any>) || {})
        : '[ERRO: executor não configurado]'
      toolCalls.push({
        name: tu.name,
        input: (tu.input as Record<string, any>) || {},
        output: result,
      })
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result,
      })
    }

    messages.push({ role: 'user', content: toolResultBlocks })

    // If we just hit max iterations on a tool_use response, fall through and
    // synthesize a fallback so the user sees *something*.
    if (iter === maxIterations - 1) {
      finalReply =
        'Desculpe, fiquei sem dados para concluir. Pode reformular ou eu chamo um atendente?'
    }
  }

  return {
    reply: finalReply,
    toolCalls,
    usage,
    costUsdCents: computeCostUsdCents(modelUsed, usage),
    modelUsed,
    handoffRequested,
  }
}
