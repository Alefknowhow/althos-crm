/**
 * OCR de cruzeiro (print de cotação da operadora, confirmação de reserva,
 * ou texto colado de um orçamento recebido por e-mail/WhatsApp) — Gemini
 * Flash, mesmo padrão de lib/ai/flight-ocr-extract.ts (provider fixo,
 * nunca alterna com Claude).
 */

import { GoogleGenAI, Type } from '@google/genai'

export type ExtractedCruiseDay = {
  day_number: number | null
  date: string | null
  port: string | null
  arrival: string | null
  departure: string | null
}

export type ExtractedCruise = {
  cruise_line: string | null
  ship_name: string | null
  itinerary_name: string | null
  embark_date: string | null
  disembark_date: string | null
  duration_nights: number | null
  embark_port: string | null
  disembark_port: string | null
  pax_adults: number | null
  pax_children: number | null
  cabin_category: string | null
  cabin_type: string | null
  cabin_price_cents: number | null
  taxes_cents: number | null
  total_cents: number | null
  pkg_drinks: string | null
  pkg_internet: string | null
  pkg_restaurants: string | null
  pkg_gratuities: string | null
  days: ExtractedCruiseDay[]
}

const SYSTEM_PROMPT = 'Você extrai dados estruturados de cotações/confirmações de cruzeiro (print de site de operadora, PDF de orçamento, texto colado de e-mail/WhatsApp) em português. Datas sempre em YYYY-MM-DD. Quando um campo não estiver presente, use null (ou array vazio pro itinerário). Se o itinerário dia a dia estiver descrito, extraia cada dia como um item — dias de navegação (sem porto) usam port="Navegação".'

const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cruise_line: { type: Type.STRING, nullable: true },
    ship_name: { type: Type.STRING, nullable: true },
    itinerary_name: { type: Type.STRING, nullable: true },
    embark_date: { type: Type.STRING, nullable: true },
    disembark_date: { type: Type.STRING, nullable: true },
    duration_nights: { type: Type.INTEGER, nullable: true },
    embark_port: { type: Type.STRING, nullable: true },
    disembark_port: { type: Type.STRING, nullable: true },
    pax_adults: { type: Type.INTEGER, nullable: true },
    pax_children: { type: Type.INTEGER, nullable: true },
    cabin_category: { type: Type.STRING, nullable: true },
    cabin_type: { type: Type.STRING, nullable: true },
    cabin_price_cents: { type: Type.INTEGER, nullable: true },
    taxes_cents: { type: Type.INTEGER, nullable: true },
    total_cents: { type: Type.INTEGER, nullable: true },
    pkg_drinks: { type: Type.STRING, nullable: true },
    pkg_internet: { type: Type.STRING, nullable: true },
    pkg_restaurants: { type: Type.STRING, nullable: true },
    pkg_gratuities: { type: Type.STRING, nullable: true },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day_number: { type: Type.INTEGER, nullable: true },
          date: { type: Type.STRING, nullable: true },
          port: { type: Type.STRING, nullable: true },
          arrival: { type: Type.STRING, nullable: true },
          departure: { type: Type.STRING, nullable: true },
        },
      },
    },
  },
  required: ['cruise_line', 'ship_name', 'itinerary_name', 'embark_date', 'disembark_date', 'duration_nights', 'embark_port', 'disembark_port', 'pax_adults', 'pax_children', 'cabin_category', 'cabin_type', 'cabin_price_cents', 'taxes_cents', 'total_cents', 'pkg_drinks', 'pkg_internet', 'pkg_restaurants', 'pkg_gratuities', 'days'],
}

function normalize(parsed: any): ExtractedCruise {
  const str = (v: any, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)
  const int = (v: any) => (Number.isFinite(Number(v)) && v != null ? Math.round(Number(v)) : null)
  const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  return {
    cruise_line: str(parsed?.cruise_line, 120),
    ship_name: str(parsed?.ship_name, 120),
    itinerary_name: str(parsed?.itinerary_name, 160),
    embark_date: date(parsed?.embark_date),
    disembark_date: date(parsed?.disembark_date),
    duration_nights: int(parsed?.duration_nights),
    embark_port: str(parsed?.embark_port, 120),
    disembark_port: str(parsed?.disembark_port, 120),
    pax_adults: int(parsed?.pax_adults),
    pax_children: int(parsed?.pax_children),
    cabin_category: str(parsed?.cabin_category, 80),
    cabin_type: str(parsed?.cabin_type, 80),
    cabin_price_cents: int(parsed?.cabin_price_cents),
    taxes_cents: int(parsed?.taxes_cents),
    total_cents: int(parsed?.total_cents),
    pkg_drinks: str(parsed?.pkg_drinks, 120),
    pkg_internet: str(parsed?.pkg_internet, 120),
    pkg_restaurants: str(parsed?.pkg_restaurants, 120),
    pkg_gratuities: str(parsed?.pkg_gratuities, 120),
    days: Array.isArray(parsed?.days) ? parsed.days.slice(0, 30).map((d: any) => ({
      day_number: int(d?.day_number),
      date: date(d?.date),
      port: str(d?.port, 120),
      arrival: str(d?.arrival, 20),
      departure: str(d?.departure, 20),
    })) : [],
  }
}

export async function extractCruiseFromImage(
  apiKey: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
): Promise<ExtractedCruise> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mediaType, data: base64 } },
        { text: 'Extraia os dados desta cotação de cruzeiro.' },
      ],
    }],
    config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA },
  })
  const text = response.text
  if (!text) throw new Error('IA não retornou dados extraídos')
  return normalize(JSON.parse(text))
}

/** Mesma extração, mas a partir de texto colado (orçamento recebido por
 *  e-mail/WhatsApp) — sem imagem, só o texto bruto. */
export async function extractCruiseFromText(apiKey: string, text: string): Promise<ExtractedCruise> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [{ role: 'user', parts: [{ text: `Extraia os dados desta cotação de cruzeiro:\n\n${text}` }] }],
    config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA },
  })
  const out = response.text
  if (!out) throw new Error('IA não retornou dados extraídos')
  return normalize(JSON.parse(out))
}
