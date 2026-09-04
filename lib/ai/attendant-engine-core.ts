/**
 * Types + system-prompt building + pricing/usage helpers for the AI
 * attendant engine. Split out of lib/ai/attendant-engine.ts.
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

  // Roteiro guiado (aba Fluxos) — lista ordenada de passos/instruções que
  // a IA deve seguir como sugestão de condução da conversa. Não é uma
  // máquina de estado: a IA decide quando avançar/pular com base na
  // conversa real, isso é só orientação estruturada no prompt.
  guidedSteps?: string[]

  // Presença = fora do horário comercial agora (calculado pelo caller a
  // partir de working_hours/timezone — o motor continua sem noção de
  // tempo/fuso). O texto é o "out_of_hours_message" configurado pelo
  // operador; a IA usa como base pra avisar de forma natural, sem
  // continuar repetindo o aviso a cada mensagem.
  outOfHours?: { message: string }

  // Per-conversation context.
  leadProfile?: {
    name?: string | null
    phone?: string | null
    email?: string | null
    source?: string | null
    tags?: string[] | null
    custom_fields?: Record<string, any> | null
    // Notas de conversas anteriores desse mesmo lead (aba Memória) — o que
    // já foi combinado/perguntado antes, pra IA não repetir.
    memoryNotes?: string | null
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

export function computeCostUsdCents(model: string, usage: AggregatedUsage): number {
  const p = PRICING_PER_M_TOKENS[model] || PRICING_PER_M_TOKENS['claude-haiku-4-5']
  const inputCents = (usage.input_tokens / 1_000_000) * p.input * 100
  const outputCents = (usage.output_tokens / 1_000_000) * p.output * 100
  const cacheWriteCents = (usage.cache_creation_input_tokens / 1_000_000) * p.cache_write * 100
  const cacheReadCents = (usage.cache_read_input_tokens / 1_000_000) * p.cache_read * 100
  return Math.round(inputCents + outputCents + cacheWriteCents + cacheReadCents)
}

export function accumulateUsage(acc: AggregatedUsage, u: Anthropic.Messages.Usage): void {
  acc.input_tokens += u.input_tokens || 0
  acc.output_tokens += u.output_tokens || 0
  acc.cache_read_input_tokens += u.cache_read_input_tokens || 0
  acc.cache_creation_input_tokens += u.cache_creation_input_tokens || 0
}

export function buildSystemBlocks(input: AttendantInput): Anthropic.Messages.TextBlockParam[] {
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

  if (input.guidedSteps && input.guidedSteps.length > 0) {
    const stepsText = input.guidedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    blocks.push({
      type: 'text',
      text:
        `\n\n# Roteiro sugerido\nUse os passos abaixo como guia pra conduzir a conversa, na ordem, mas não trate como formulário rígido — se o cliente já respondeu algo, pule esse passo; se ele mudar de assunto, adapte-se e volte ao roteiro quando fizer sentido:\n${stepsText}`,
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

  // Fora do horário comercial (volátil — muda com o relógio, não pode
  // entrar no prefixo cacheado). Vem antes do lead profile só por ordem
  // de leitura natural.
  if (input.outOfHours) {
    blocks.push({
      type: 'text',
      text:
        `\n\n# Fora do horário comercial\nAgora é fora do expediente. Se esta for a primeira mensagem sua nesta conversa, avise disso de forma natural e breve (algo no espírito de: "${input.outOfHours.message}"), mas continue atendendo normalmente — responda dúvidas, colete informações, qualifique o lead. NÃO repita esse aviso se você já mandou uma mensagem antes nesta conversa (veja o histórico).`,
    })
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
    if (p.memoryNotes && p.memoryNotes.trim()) {
      profileLines.push(
        `\n# O que sabemos de atendimentos anteriores com esse cliente\n${p.memoryNotes.trim()}\nNão repita perguntas cuja resposta já está aqui.`,
      )
    }
    blocks.push({ type: 'text', text: profileLines.join('\n') })
  }

  return blocks
}

export function detectHandoff(messages: AttendantTurn[], phrases: string[]): boolean {
  const last = [...messages].reverse().find(m => m.role === 'user')
  if (!last) return false
  const text = last.content.toLowerCase()
  return phrases.some(p => text.includes(p.toLowerCase()))
}
