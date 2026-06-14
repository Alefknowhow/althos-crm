'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { serializeHelpForAI } from '@/lib/help/content'
import { BRAND } from '@/lib/constants/brand'

export type SupportRole = 'user' | 'assistant'
export type SupportMessage = { role: SupportRole; content: string }

export type SupportReply = {
  ok: boolean
  text: string
  /** True when the model judged a human handoff is warranted. */
  suggestHandoff: boolean
  error?: string
}

// Cache the serialized manual once per server instance — it never changes at runtime.
let MANUAL_CACHE: string | null = null
function getManual(): string {
  if (MANUAL_CACHE === null) MANUAL_CACHE = serializeHelpForAI()
  return MANUAL_CACHE
}

const HANDOFF_TOKEN = '[[HANDOFF]]'

/**
 * Answer a user's support question using the Althos manual as the single
 * knowledge source. Returns the assistant reply and whether a human handoff
 * (to WhatsApp) should be offered.
 */
export async function askSupport(
  orgSlug: string,
  messages: SupportMessage[],
): Promise<SupportReply> {
  try {
    const supabase = createClient()

    // Centralized platform token (env) — same key for every account.
    const apiKey = process.env.ANTHROPIC_API_KEY || ''
    let model = 'claude-haiku-4-5'
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('ai_qualifier_model')
        .eq('slug', orgSlug)
        .maybeSingle()
      if (org?.ai_qualifier_model) model = org.ai_qualifier_model
    } catch {
      /* ignore — use platform defaults */
    }

    if (!apiKey) {
      return {
        ok: false,
        text: 'O suporte por IA não está disponível no momento. Você pode falar com nossa equipe pelo WhatsApp.',
        suggestHandoff: true,
        error: 'no_api_key',
      }
    }

    const client = new Anthropic({ apiKey })

    const system = [
      {
        type: 'text' as const,
        text: [
          `Você é o assistente de suporte do ${BRAND.name}, um CRM com automação de vendas e IA.`,
          'Seu papel é ajudar o usuário a usar o produto: explicar funcionalidades, dar o passo a passo e sugerir a melhor forma de usar cada ferramenta para ter resultado.',
          '',
          'REGRAS:',
          '- Responda SEMPRE em português do Brasil, de forma clara, amigável e objetiva.',
          '- Use APENAS as informações do MANUAL abaixo. Não invente telas, botões ou funcionalidades que não existem no manual.',
          '- Quando fizer sentido, oriente em passos numerados e cite o caminho de menu (ex.: "Configurações → Social").',
          '- Seja conciso: vá direto ao ponto, mas sem omitir passos importantes.',
          `- Se o usuário pedir explicitamente para falar com um humano/atendente, ou se a dúvida for sobre cobrança/problema técnico/bug/algo fora do manual que você não consegue resolver, finalize a resposta com o marcador ${HANDOFF_TOKEN} em uma linha separada, depois de orientar o que for possível.`,
          `- Nunca exponha o marcador ${HANDOFF_TOKEN} como texto explicativo; ele é apenas um sinal interno.`,
        ].join('\n'),
      },
      {
        type: 'text' as const,
        text: getManual(),
        // Prompt caching: the large manual block is stable across calls.
        cache_control: { type: 'ephemeral' as const },
      },
    ]

    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const res = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages: trimmed,
    })

    const block = res.content.find((b) => b.type === 'text') as
      | Anthropic.Messages.TextBlock
      | undefined
    let text = (block?.text || '').trim()

    const suggestHandoff = text.includes(HANDOFF_TOKEN)
    if (suggestHandoff) {
      text = text.replaceAll(HANDOFF_TOKEN, '').trim()
    }

    if (!text) {
      return {
        ok: true,
        text: 'Desculpe, não consegui formular uma resposta. Pode reformular a pergunta?',
        suggestHandoff: false,
      }
    }

    return { ok: true, text, suggestHandoff }
  } catch (e: any) {
    console.error('[support-chat] failed:', e?.message)
    return {
      ok: false,
      text: 'Tive um problema para responder agora. Tente novamente em instantes ou fale com nossa equipe pelo WhatsApp.',
      suggestHandoff: true,
      error: e?.message || 'unknown',
    }
  }
}
