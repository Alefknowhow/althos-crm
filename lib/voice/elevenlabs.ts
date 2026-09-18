import { getElevenLabsKey, hasElevenLabsKey } from '@/lib/ai/api-key'

/**
 * Vozes/TTS da ElevenLabs para os agentes de Voice AI do módulo Voice.
 * Reaproveita a mesma chave central (`getElevenLabsKey()`) já usada por
 * lib/ai/speech-to-text.ts e pelo serviço sales-coach-realtime — uma única
 * conta ElevenLabs para toda a plataforma. Server-only.
 */

export interface ElevenLabsVoice {
  voiceId: string
  name: string
  previewUrl: string | null
  category?: string
}

export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  if (!hasElevenLabsKey()) return []
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': getElevenLabsKey() },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`ElevenLabs voices: ${res.status}`)
  const data = await res.json() as { voices?: any[] }
  return (data.voices ?? []).map(v => ({
    voiceId: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url ?? null,
    category: v.category,
  }))
}

/** Sintetiza `text` na voz `voiceId`, retornando o áudio (mp3) como Buffer. */
export async function synthesizeSpeech(text: string, voiceId: string): Promise<Buffer> {
  if (!hasElevenLabsKey()) throw new Error('ElevenLabs não configurado (ELEVENLABS_API_KEY ausente).')
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': getElevenLabsKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
