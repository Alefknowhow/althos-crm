/**
 * OCR de bilhete/itinerário aéreo (print de app da companhia, e-ticket,
 * cartão de embarque) — SEMPRE via Gemini Flash (nunca Claude aqui, por
 * pedido explícito: mantém um único provider previsível pra esse fluxo,
 * diferente de lib/ai/document-extract.ts e financial-document-extract.ts,
 * que alternam Claude/Gemini conforme organizations.ocr_provider).
 *
 * Devolve uma LISTA de trechos — um print pode conter ida+volta ou uma
 * conexão com mais de um voo. Cada campo mapeia 1:1 pra uma coluna de
 * quotation_flights (ver migration 0173_quotation_flights_time_and_code.sql).
 */

import { GoogleGenAI, Type } from '@google/genai'

export type ExtractedFlightLeg = {
  leg_type: 'outbound' | 'inbound' | 'connection' | null
  from_city: string | null
  from_code: string | null
  to_city: string | null
  to_code: string | null
  airline: string | null
  flight_number: string | null
  departure_date: string | null
  departure_time: string | null
  arrival_date: string | null
  arrival_time: string | null
  duration_label: string | null
  stopover_label: string | null
  cabin_class: 'economica' | 'premium' | 'executiva' | 'primeira' | null
  baggage: ('item_pessoal' | 'mao' | 'despachada')[]
}

const SYSTEM_PROMPT = `Você extrai dados estruturados de prints de bilhete/itinerário aéreo (app de companhia aérea, e-ticket, cartão de embarque, confirmação de compra) em português ou inglês. Um print pode conter mais de um trecho (ida e volta, ou uma conexão com dois voos) — devolva UM item por trecho/voo físico. Se um trecho tiver conexão (ex.: São Paulo → Lisboa via Lisboa/Madrid), ainda assim devolva um item por voo físico, marcando leg_type "connection" pro trecho intermediário quando fizer sentido, ou concatene os códigos de voo em flight_number (ex.: "LA3380; LA3385") se o print tratar o trecho como um bloco só. Datas sempre em YYYY-MM-DD. Horários sempre em HH:mm (24h). Quando um campo não estiver no print, use null (ou array vazio pra bagagem).`

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    legs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          leg_type: { type: Type.STRING, nullable: true, enum: ['outbound', 'inbound', 'connection'] },
          from_city: { type: Type.STRING, nullable: true },
          from_code: { type: Type.STRING, nullable: true, description: 'Sigla IATA do aeroporto de origem, ex.: GRU' },
          to_city: { type: Type.STRING, nullable: true },
          to_code: { type: Type.STRING, nullable: true, description: 'Sigla IATA do aeroporto de destino' },
          airline: { type: Type.STRING, nullable: true },
          flight_number: { type: Type.STRING, nullable: true, description: 'Código(s) do voo, separados por "; " se houver mais de um' },
          departure_date: { type: Type.STRING, nullable: true },
          departure_time: { type: Type.STRING, nullable: true },
          arrival_date: { type: Type.STRING, nullable: true },
          arrival_time: { type: Type.STRING, nullable: true },
          duration_label: { type: Type.STRING, nullable: true, description: 'Duração do voo, ex.: "9h35"' },
          stopover_label: { type: Type.STRING, nullable: true, description: 'Local e tempo de conexão/escala, ex.: "Lisboa (LIS) — 2h10 de conexão"' },
          cabin_class: { type: Type.STRING, nullable: true, enum: ['economica', 'premium', 'executiva', 'primeira'] },
          baggage: { type: Type.ARRAY, items: { type: Type.STRING, enum: ['item_pessoal', 'mao', 'despachada'] } },
        },
      },
    },
  },
  required: ['legs'],
}

export async function extractFlightLegsFromImage(
  apiKey: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
): Promise<ExtractedFlightLeg[]> {
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mediaType, data: base64 } },
        { text: 'Extraia os trechos de voo deste print/itinerário aéreo.' },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  })

  const text = response.text
  if (!text) throw new Error('IA não retornou dados extraídos')

  const parsed = JSON.parse(text)
  return normalizeLegs(parsed?.legs)
}

function normalizeLegs(raw: any): ExtractedFlightLeg[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 10).map((v: any) => ({
    leg_type: v?.leg_type === 'outbound' || v?.leg_type === 'inbound' || v?.leg_type === 'connection' ? v.leg_type : null,
    from_city: typeof v?.from_city === 'string' ? v.from_city.slice(0, 120) : null,
    from_code: typeof v?.from_code === 'string' ? v.from_code.toUpperCase().slice(0, 8) : null,
    to_city: typeof v?.to_city === 'string' ? v.to_city.slice(0, 120) : null,
    to_code: typeof v?.to_code === 'string' ? v.to_code.toUpperCase().slice(0, 8) : null,
    airline: typeof v?.airline === 'string' ? v.airline.slice(0, 120) : null,
    flight_number: typeof v?.flight_number === 'string' ? v.flight_number.slice(0, 60) : null,
    departure_date: /^\d{4}-\d{2}-\d{2}$/.test(v?.departure_date) ? v.departure_date : null,
    departure_time: typeof v?.departure_time === 'string' ? v.departure_time.slice(0, 10) : null,
    arrival_date: /^\d{4}-\d{2}-\d{2}$/.test(v?.arrival_date) ? v.arrival_date : null,
    arrival_time: typeof v?.arrival_time === 'string' ? v.arrival_time.slice(0, 10) : null,
    duration_label: typeof v?.duration_label === 'string' ? v.duration_label.slice(0, 60) : null,
    stopover_label: typeof v?.stopover_label === 'string' ? v.stopover_label.slice(0, 160) : null,
    cabin_class: ['economica', 'premium', 'executiva', 'primeira'].includes(v?.cabin_class) ? v.cabin_class : null,
    baggage: Array.isArray(v?.baggage) ? v.baggage.filter((b: any) => ['item_pessoal', 'mao', 'despachada'].includes(b)) : [],
  }))
}
