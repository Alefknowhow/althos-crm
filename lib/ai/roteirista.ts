/**
 * Geração de roteiro de viagem via Gemini Flash 2.5, com busca na web
 * (grounding) pra estimar período mais barato, preços de passagem e
 * avaliações de hotéis. Sem responseSchema: a API do Gemini não permite
 * combinar googleSearch com saída JSON estruturada, então o modelo escreve
 * um único bloco de HTML rico (mesmo padrão de itinerary_html em
 * travel_proposals), com seções conforme o modo escolhido.
 */

import { GoogleGenAI } from '@google/genai'

export type RoteiroMode = 'completo' | 'hoteis' | 'voos'

export type RoteiroInput = {
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
  knowledgeContext: string
}

const MODE_INSTRUCTIONS: Record<RoteiroMode, string> = {
  completo: 'Gere um roteiro de viagem completo: sugestão de período (se flexível), estimativa de preço de passagens aéreas, sugestões de hospedagem com nota/avaliação, e um roteiro dia a dia com atividades.',
  hoteis: 'Foque SOMENTE em sugestões de hospedagem: pelo menos 3 opções de hotéis/pousadas com faixa de preço estimada, nota/avaliação, localização e pontos fortes. Não gere roteiro dia a dia nem informações de voo.',
  voos: 'Foque SOMENTE em passagens aéreas: estimativa de preço, companhias que operam a rota, e — se o período for flexível — qual janela de datas tende a ser mais barata. Não gere roteiro dia a dia nem sugestões de hotel.',
}

function buildPrompt(input: RoteiroInput): string {
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
    input.knowledgeContext ? `\nConhecimento interno da agência (considere essas informações quando relevantes):\n${input.knowledgeContext}` : '',
    '',
    'Responda em HTML simples (use <h3>, <p>, <ul>/<li>, <strong> — sem <html>/<body>/<style>), em português do Brasil, pronto pra ser exibido direto numa página. Use a busca na web pra trazer preços e avaliações o mais reais possível, e deixe claro quando um valor é uma estimativa.',
  ].join('\n')
}

export async function generateRoteiro(apiKey: string, input: RoteiroInput): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: 'Você é um especialista em planejamento de viagens que trabalha para uma agência de viagens brasileira. Seja específico, cite nomes de hotéis/companhias reais quando encontrar via busca, e nunca invente preços exatos sem sinalizar que são estimativas.',
    },
  })

  const text = response.text
  if (!text) throw new Error('IA não retornou o roteiro')
  return text
}
