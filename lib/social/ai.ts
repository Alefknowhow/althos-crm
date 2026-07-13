import Anthropic from '@anthropic-ai/sdk'

export type InboundKind = 'dm' | 'comment'

/** Gera uma resposta social curta e natural via Claude. Compartilhado pelo
 *  motor de automações simples e pelo motor de funil de conversa. */
export async function generateAiReply(opts: {
  apiKey: string
  model?: string | null
  orgName?: string | null
  businessContext?: string | null
  instructions?: string | null
  inboundKind: InboundKind
  inboundText: string
  senderUsername?: string | null
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey })

  const system = [
    `Você é o atendente social de ${opts.orgName || 'uma empresa'} respondendo no Instagram.`,
    opts.businessContext ? `Contexto do negócio:\n${opts.businessContext}` : '',
    opts.instructions ? `Instruções específicas deste passo:\n${opts.instructions}` : '',
    'Regras: responda de forma curta, simpática e natural, como um humano da equipe.',
    'Use no máximo 2 frases. Não use linguagem robótica. Pode usar 1 emoji quando fizer sentido.',
    opts.inboundKind === 'comment'
      ? 'Esta é uma resposta pública a um comentário — seja acolhedor e convide a pessoa a chamar no direct se precisar de mais detalhes.'
      : 'Esta é uma resposta a uma mensagem privada (direct).',
  ]
    .filter(Boolean)
    .join('\n\n')

  const userMsg = opts.senderUsername
    ? `@${opts.senderUsername} disse: "${opts.inboundText}"`
    : `Mensagem recebida: "${opts.inboundText}"`

  const res = await client.messages.create({
    model: opts.model || 'claude-haiku-4-5',
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userMsg }],
  })
  const block = res.content.find(b => b.type === 'text') as Anthropic.Messages.TextBlock | undefined
  return (block?.text || '').trim()
}
