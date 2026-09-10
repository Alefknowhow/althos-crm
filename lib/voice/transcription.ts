/**
 * Transcrição de gravações de chamada via Gemini (mesmo padrão de
 * lib/ai/document-extract-gemini.ts — visão/áudio nativo do Gemini, sem SDK
 * de transcrição dedicado). Baixa o áudio da URL de gravação do provider e
 * pede um JSON estruturado (texto integral + segmentos por interlocutor,
 * quando o modelo conseguir diferenciar as duas vozes).
 */
import { GoogleGenAI, Type } from '@google/genai'
import { getGeminiKey } from '../ai/api-key'

export interface TranscriptSegment {
  speaker: string
  start_s: number | null
  text: string
}

export interface TranscriptionResult {
  fullText: string
  segments: TranscriptSegment[]
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    full_text: { type: Type.STRING },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, description: 'AGENTE ou CLIENTE' },
          start_s: { type: Type.NUMBER, nullable: true },
          text: { type: Type.STRING },
        },
        required: ['speaker', 'text'],
      },
    },
  },
  required: ['full_text', 'segments'],
}

export async function transcribeRecording(recordingUrl: string, authHeader?: string): Promise<TranscriptionResult> {
  const audioRes = await fetch(recordingUrl, { headers: authHeader ? { Authorization: authHeader } : undefined })
  if (!audioRes.ok) throw new Error(`Falha ao baixar gravação: ${audioRes.status}`)
  const buffer = Buffer.from(await audioRes.arrayBuffer())
  const base64 = buffer.toString('base64')

  const ai = new GoogleGenAI({ apiKey: getGeminiKey() })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'audio/mpeg', data: base64 } },
        { text: 'Transcreva esta ligação telefônica em português do Brasil. Separe as falas por interlocutor (AGENTE = quem atende/liga da empresa, CLIENTE = a outra pessoa). Se não conseguir diferenciar as vozes com confiança, coloque tudo num único segmento com speaker "INDEFINIDO".' },
      ],
    }],
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  })

  const parsed = JSON.parse(response.text ?? '{}')
  return { fullText: parsed.full_text ?? '', segments: parsed.segments ?? [] }
}
