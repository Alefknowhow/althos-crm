/**
 * Roteirista: chat de viagem via Gemini 3.6 Flash, com busca na web
 * (grounding) pra estimar período mais barato, preços de passagem e
 * avaliações de hotéis. Sem responseSchema: a API do Gemini não permite
 * combinar googleSearch com saída JSON estruturada, então o modelo escreve
 * HTML rico (mesmo padrão de itinerary_html em travel_proposals) em cada
 * resposta, e a conversa continua turno a turno.
 */

import { GoogleGenAI } from '@google/genai'

export type RoteiroMode = 'completo' | 'hoteis' | 'voos'

export type RoteiroQuickStartInput = {
  mode: RoteiroMode
  destino: string
  dataIda: string | null
  dataVolta: string | null
  periodoFlexivel: boolean
  mesReferencia: string | null
  paxAdults: number
  paxChildren: number
  nivelConforto: string | null
  orcamentoCents: number | null
  interesses: string | null
  observacoes: string | null
}

const MODE_INSTRUCTIONS: Record<RoteiroMode, string> = {
  completo: 'Gere um roteiro de viagem completo: sugestão de período (se flexível), estimativa de preço de passagens aéreas, sugestões de hospedagem com nota/avaliação, e um roteiro dia a dia com atividades.',
  hoteis: 'Foque SOMENTE em sugestões de hospedagem: pelo menos 3 opções de hotéis/pousadas com faixa de preço estimada, nota/avaliação, localização e pontos fortes. Não gere roteiro dia a dia nem informações de voo.',
  voos: 'Foque SOMENTE em passagens aéreas: estimativa de preço, companhias que operam a rota, e — se o período for flexível — qual janela de datas tende a ser mais barata. Não gere roteiro dia a dia nem sugestões de hotel.',
}

/** Compõe a primeira mensagem do chat a partir do formulário-atalho — texto puro, sem chamar a IA. */
export function buildQuickStartMessage(input: RoteiroQuickStartInput): string {
  const paxLine = `${input.paxAdults} adulto(s)${input.paxChildren > 0 ? ` + ${input.paxChildren} criança(s)` : ''}`
  const dateLine = input.periodoFlexivel
    ? `Período flexível — buscar a janela mais barata${input.mesReferencia ? ` em torno de ${input.mesReferencia}` : ''}.`
    : `Ida: ${input.dataIda ?? 'não informado'} · Volta: ${input.dataVolta ?? 'não informado'}.`

  const lines = [
    `Destino: ${input.destino}`,
    dateLine,
    `Viajantes: ${paxLine}`,
    input.nivelConforto ? `Nível de conforto: ${input.nivelConforto}` : null,
    input.orcamentoCents ? `Orçamento aproximado: R$ ${(input.orcamentoCents / 100).toFixed(2)}` : null,
    input.interesses ? `Interesses: ${input.interesses}` : null,
    input.observacoes ? `Observações adicionais: ${input.observacoes}` : null,
  ].filter(Boolean)

  return [
    MODE_INSTRUCTIONS[input.mode],
    '',
    'Dados da solicitação:',
    ...lines.map(l => `- ${l}`),
  ].join('\n')
}

export type RoteiroChatTurn = { role: 'user' | 'assistant'; content: string }

/** Envia o histórico completo da conversa e retorna a resposta do turno atual. */
export async function sendRoteiroChatMessage(
  apiKey: string,
  history: RoteiroChatTurn[],
  knowledgeContext: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })

  const systemInstruction = [
    'Você é um especialista em planejamento de viagens que trabalha para uma agência de viagens brasileira, conversando em um chat com um atendente da agência. Responda em português do Brasil.',
    'Seja específico, cite nomes de hotéis/companhias reais quando encontrar via busca, e nunca invente preços exatos sem sinalizar que são estimativas. Use a busca na web pra trazer preços e avaliações o mais reais possível.',
    'Responda em HTML simples (use <h3>, <p>, <ul>/<li>, <strong> — sem <html>/<body>/<style>), pronto pra ser exibido direto numa página.',
    knowledgeContext ? `\nConhecimento interno da agência (considere essas informações quando relevantes):\n${knowledgeContext}` : '',
  ].join('\n')

  const contents = history.map(turn => ({
    role: turn.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: turn.content }],
  }))

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction,
    },
  })

  const text = response.text
  if (!text) throw new Error('IA não retornou uma resposta')
  return text
}
