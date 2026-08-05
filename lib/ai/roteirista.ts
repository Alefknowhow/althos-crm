/**
 * Roteirista: chat de viagem via Gemini 3.6 Flash, com busca na web
 * (grounding) pra estimar período mais barato, preços de passagem e
 * avaliações de hotéis. Sem responseSchema: a API do Gemini não permite
 * combinar googleSearch com saída JSON estruturada, então o modelo escreve
 * HTML rico (mesmo padrão de itinerary_html em travel_proposals) em cada
 * resposta, e a conversa continua turno a turno.
 */

import { GoogleGenAI, Type } from '@google/genai'

/**
 * Desativado temporariamente — consumo de tokens (grounding + geração de
 * texto longo) tinha custo alto pra um resultado que o usuário consegue
 * reproduzir de graça pesquisando direto no chat do Gemini. Mantém o
 * código intacto pra religar depois.
 */
export const TRAVEL_PLANNER_ENABLED = false

export type RoteiroMode = 'completo' | 'hoteis' | 'voos'
export type RoteiroTurno = 'manha' | 'tarde' | 'noite'

const TURNO_LABEL: Record<RoteiroTurno, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' }

export type RoteiroQuickStartInput = {
  mode: RoteiroMode
  origem: string | null
  destino: string
  dataIda: string | null
  dataVolta: string | null
  turnoIda: RoteiroTurno | null
  turnoVolta: RoteiroTurno | null
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
    : `Ida: ${input.dataIda ?? 'não informado'}${input.turnoIda ? ` (turno preferido: ${TURNO_LABEL[input.turnoIda]})` : ''} · Volta: ${input.dataVolta ?? 'não informado'}${input.turnoVolta ? ` (turno preferido: ${TURNO_LABEL[input.turnoVolta]})` : ''}.`

  const lines = [
    input.origem ? `Origem: ${input.origem}` : null,
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
    'Responda em HTML simples (use <h3>, <p>, <ul>/<li>, <strong> — sem <html>/<body>/<style>), pronto pra ser exibido direto numa página. NUNCA use classes CSS (class="...") — o HTML é salvo no banco e renderizado fora do build, então qualquer classe fica sem estilo. Para qualquer destaque visual, use APENAS atributo style="..." inline.',
    '',
    'Quando responder com opções de VOOS, monte um "cartão de voos" estruturado (não uma lista de texto corrido), seguindo exatamente este padrão HTML — repita o bloco de linha (<div style="display:flex...">) uma vez por opção de voo encontrada (pelo menos 3, se houver), preenchendo com dados reais da busca:',
    `<div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:12px 0;font-family:inherit;">
  <div style="background:#eef2ff;padding:10px 14px;font-size:13px;color:#374151;display:flex;align-items:center;gap:8px;">
    <strong>Ida</strong> · Origem (XXX) → Destino (YYY) · DD/MM · N adultos, M crianças
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-top:1px solid #e5e7eb;">
    <div style="min-width:100px;font-weight:600;font-size:14px;">05:00 – 09:20</div>
    <div style="flex:1;text-align:center;color:#6b7280;font-size:13px;">GYN – NAT</div>
    <div style="min-width:120px;text-align:center;color:#6b7280;font-size:13px;">1 escala · 4h20</div>
    <div style="min-width:90px;text-align:right;font-weight:600;font-size:14px;">R$ 3.457</div>
  </div>
  <!-- repita a linha acima para cada opção de voo -->
</div>`,
    'Use um bloco desses pra "Ida" e outro pra "Volta" quando a busca for de ida e volta. Se não encontrar preço exato, escreva "~R$ X.XXX" e mencione no texto ao redor que é uma estimativa.',
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

export type QuotationDraft = {
  origem: string | null
  destino: string | null
  data_ida: string | null
  data_volta: string | null
  flights_html: string | null
  lodgings: Array<{
    name: string
    room_category: string | null
    board: string | null
    description_html: string | null
    price_per_person_cents: number | null
  }>
  itinerary_html: string | null
  price_per_person_cents: number | null
  total_cents: number | null
}

const QUOTATION_EXTRACT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    origem: { type: Type.STRING, nullable: true, description: 'Cidade de origem da viagem' },
    destino: { type: Type.STRING, nullable: true, description: 'Cidade/destino principal' },
    data_ida: { type: Type.STRING, nullable: true, description: 'YYYY-MM-DD' },
    data_volta: { type: Type.STRING, nullable: true, description: 'YYYY-MM-DD' },
    flights_html: { type: Type.STRING, nullable: true, description: 'HTML dos cartões de voos (ida e volta) mencionados na conversa, no mesmo formato de cartão já usado, com style inline' },
    lodgings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          room_category: { type: Type.STRING, nullable: true },
          board: { type: Type.STRING, nullable: true, description: 'Regime de alimentação, ex.: "Café da manhã", "All inclusive"' },
          description_html: { type: Type.STRING, nullable: true },
          price_per_person_cents: { type: Type.INTEGER, nullable: true },
        },
        required: ['name'],
      },
    },
    itinerary_html: { type: Type.STRING, nullable: true, description: 'HTML do roteiro dia a dia / atividades, SEM repetir os cartões de voo ou a lista de hotéis (esses já vão em campos separados)' },
    price_per_person_cents: { type: Type.INTEGER, nullable: true },
    total_cents: { type: Type.INTEGER, nullable: true },
  },
  required: ['origem', 'destino', 'data_ida', 'data_volta', 'flights_html', 'lodgings', 'itinerary_html', 'price_per_person_cents', 'total_cents'],
}

/**
 * Lê a conversa inteira do Roteirista e extrai os campos estruturados de uma
 * cotação (origem, destino, voos, hospedagem, roteiro) — usado só quando o
 * usuário clica "Transformar em cotação". Sem busca na web aqui: é só
 * interpretar o que já foi conversado, então pode usar responseSchema.
 */
export async function extractQuotationDraft(apiKey: string, conversationText: string): Promise<QuotationDraft> {
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: conversationText }] }],
    config: {
      systemInstruction: 'Você extrai dados estruturados de uma conversa entre um atendente de agência de viagens e uma IA de planejamento. Preencha os campos com o que foi efetivamente discutido/decidido na conversa (use a opção de voo/hotel mais recente ou mais claramente escolhida, se houver várias). Quando um dado não aparecer na conversa, use null. HTML deve usar apenas style inline, nunca class.',
      responseMimeType: 'application/json',
      responseSchema: QUOTATION_EXTRACT_SCHEMA,
    },
  })

  const text = response.text
  if (!text) throw new Error('IA não retornou os dados extraídos')
  const parsed = JSON.parse(text)
  return {
    origem: parsed.origem || null,
    destino: parsed.destino || null,
    data_ida: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_ida) ? parsed.data_ida : null,
    data_volta: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_volta) ? parsed.data_volta : null,
    flights_html: parsed.flights_html || null,
    lodgings: Array.isArray(parsed.lodgings)
      ? parsed.lodgings.slice(0, 10).map((l: any) => ({
          name: typeof l?.name === 'string' ? l.name.slice(0, 200) : 'Hospedagem',
          room_category: typeof l?.room_category === 'string' ? l.room_category.slice(0, 160) : null,
          board: typeof l?.board === 'string' ? l.board.slice(0, 80) : null,
          description_html: typeof l?.description_html === 'string' ? l.description_html : null,
          price_per_person_cents: Number.isFinite(Number(l?.price_per_person_cents)) ? Math.round(Number(l.price_per_person_cents)) : null,
        }))
      : [],
    itinerary_html: parsed.itinerary_html || null,
    price_per_person_cents: Number.isFinite(Number(parsed.price_per_person_cents)) ? Math.round(Number(parsed.price_per_person_cents)) : null,
    total_cents: Number.isFinite(Number(parsed.total_cents)) ? Math.round(Number(parsed.total_cents)) : null,
  }
}
