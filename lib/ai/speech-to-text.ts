/**
 * Speech-to-text via ElevenLabs (modelo `scribe_v1`), usado pelo Copiloto
 * (Althos AI) para transcrever áudio enviado no chat. Chave centralizada
 * (ELEVENLABS_API_KEY, ver lib/ai/api-key.ts) — mesmo modelo das demais
 * integrações de IA da plataforma.
 */
import { getElevenLabsKey } from './api-key'

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text'

export async function transcribeAudioElevenLabs(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const apiKey = getElevenLabsKey()
  if (!apiKey) {
    throw new Error('ElevenLabs não configurado neste ambiente (ELEVENLABS_API_KEY ausente).')
  }

  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), filename)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Falha na transcrição (ElevenLabs ${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = await res.json().catch(() => null)
  const text = (data?.text as string | undefined)?.trim()
  if (!text) throw new Error('Não foi possível identificar fala no áudio.')
  return text
}
