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
 *
 * Types, system-prompt building and pricing helpers split out to
 * attendant-engine-core.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  computeCostUsdCents, accumulateUsage, buildSystemBlocks, detectHandoff,
  type AttendantTurn, type AttendantInput, type AttendantConfig, type ToolCallRecord,
  type AggregatedUsage, type AttendantResult,
} from './attendant-engine-core'

export type {
  AttendantTurn, AttendantInput, AttendantConfig, ToolCallRecord, AggregatedUsage, AttendantResult,
} from './attendant-engine-core'

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

/**
 * Gera um resumo estruturado da conversa pro atendente humano que vai
 * assumir depois de um handoff (seção 15 do documento de reestruturação).
 * Chamada separada e mais barata que respondAsAttendant — sem tools, sem
 * loop, só extrai o que já foi dito. Nunca é enviada ao cliente.
 */
export async function summarizeForHandoff(
  input: { messages: AttendantTurn[]; leadProfile?: AttendantInput['leadProfile']; orgName?: string },
  config: { apiKey: string; model?: string },
): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey })

  const transcript = input.messages
    .map(m => `${m.role === 'user' ? 'Cliente' : 'IA'}: ${m.content}`)
    .join('\n')

  const system = [
    'Você resume uma conversa de atendimento pro atendente humano que vai assumir agora.',
    'Preencha SOMENTE com o que foi dito de fato na conversa abaixo — nunca invente ou deduza além do que está escrito.',
    'Responda EXATAMENTE neste formato, uma linha por campo, omitindo por completo a linha de qualquer campo sem informação (não escreva "não informado"):',
    'Cliente:\nInteresse:\nNecessidade:\nOrçamento:\nData:\nProduto:\nPrincipais dúvidas:\nObjeções:\nStatus:\nPróxima ação recomendada:',
  ].join('\n\n')

  const res = await client.messages.create({
    model: config.model || 'claude-haiku-4-5',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: `Conversa:\n${transcript}` }],
  })
  const block = res.content.find(b => b.type === 'text') as Anthropic.Messages.TextBlock | undefined
  return (block?.text || '').trim()
}

/* ─────────────────────────── Streaming variant ───────────────────────────
 * Used by the Inicial copiloto dock. Same tool loop as respondAsAttendant,
 * but streams the model's text as it's generated instead of awaiting the
 * whole response — the tool-use iterations themselves still run to
 * completion before the next call (a tool round-trip is fast and mostly
 * invisible; only the final natural-language answer needs to feel "live").
 */

export type CopilotStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, any>; result: string }
  | { type: 'done'; reply: string; usage: AggregatedUsage; modelUsed: string; costUsdCents: number }

export async function* respondAsAttendantStream(
  input: AttendantInput,
  config: AttendantConfig,
): AsyncGenerator<CopilotStreamEvent, void, unknown> {
  const client = new Anthropic({ apiKey: config.apiKey })

  const systemBlocks = buildSystemBlocks(input)
  const model = config.model || 'claude-haiku-4-5'
  const maxIterations = config.maxIterations ?? 5
  const hasTools = (input.tools?.length ?? 0) > 0 && !!input.executeTool

  const messages: Anthropic.Messages.MessageParam[] = input.messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  const usage: AggregatedUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }

  let modelUsed = model
  let finalReply = ''

  for (let iter = 0; iter < maxIterations; iter++) {
    const stream = client.messages.stream({
      model,
      max_tokens: config.maxOutputTokens ?? 1200,
      system: systemBlocks,
      messages,
      ...(hasTools && { tools: input.tools }),
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text_delta', text: event.delta.text }
      }
    }

    const response = await stream.finalMessage()
    accumulateUsage(usage, response.usage)
    modelUsed = response.model

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find(b => b.type === 'text') as
        | Anthropic.Messages.TextBlock
        | undefined
      finalReply = textBlock?.text || ''
      break
    }

    messages.push({ role: 'assistant', content: response.content })

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    )
    const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const tu of toolUseBlocks) {
      const result = input.executeTool
        ? await input.executeTool(tu.name, (tu.input as Record<string, any>) || {})
        : '[ERRO: executor não configurado]'
      yield { type: 'tool_call', name: tu.name, input: (tu.input as Record<string, any>) || {}, result }
      toolResultBlocks.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
    }
    messages.push({ role: 'user', content: toolResultBlocks })

    if (iter === maxIterations - 1) {
      finalReply = 'Desculpe, fiquei sem dados para concluir. Pode reformular ou eu chamo um atendente?'
    }
  }

  yield {
    type: 'done',
    reply: finalReply,
    usage,
    modelUsed,
    costUsdCents: computeCostUsdCents(modelUsed, usage),
  }
}
