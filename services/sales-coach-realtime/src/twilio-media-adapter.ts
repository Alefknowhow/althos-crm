/**
 * Decodifica os frames de áudio que a Twilio manda pelo Media Streams
 * (`<Stream track="both_tracks">` anexado via `calls(sid).streams.create`,
 * ver lib/voice/providers/twilio.ts::startMediaStream no repo principal) —
 * mulaw (G.711) 8kHz mono, base64, um frame por mensagem `media` — e
 * converte para PCM16 16kHz base64, o formato que o
 * ElevenLabsRealtimeProvider já espera (mesmo pipeline usado pelo IA Sales
 * Coach, ver speech-to-text-provider.ts: `audio_format=pcm_16000`).
 *
 * Upsample 8kHz→16kHz por interpolação linear simples (duplica amostras
 * com média entre vizinhas) — suficiente para fala/STT, não é
 * reconstrução de banda alta-fidelidade.
 */

// Tabela padrão de decodificação μ-law → PCM16 linear (ITU-T G.711).
const MULAW_DECODE_TABLE = new Int16Array(256)
;(function buildMulawTable() {
  const MULAW_BIAS = 0x84
  for (let i = 0; i < 256; i++) {
    let muVal = ~i & 0xff
    const sign = muVal & 0x80
    const exponent = (muVal >> 4) & 0x07
    const mantissa = muVal & 0x0f
    let sample = ((mantissa << 3) + MULAW_BIAS) << exponent
    sample -= MULAW_BIAS
    MULAW_DECODE_TABLE[i] = sign ? -sample : sample
  }
})()

function decodeMulawToPcm16(mulaw: Buffer): Int16Array {
  const out = new Int16Array(mulaw.length)
  for (let i = 0; i < mulaw.length; i++) out[i] = MULAW_DECODE_TABLE[mulaw[i]]
  return out
}

/** Duplica cada amostra com interpolação linear simples: 8kHz → 16kHz. */
function upsample2x(pcm8k: Int16Array): Int16Array {
  const out = new Int16Array(pcm8k.length * 2)
  for (let i = 0; i < pcm8k.length; i++) {
    const cur = pcm8k[i]
    const next = i + 1 < pcm8k.length ? pcm8k[i + 1] : cur
    out[i * 2] = cur
    out[i * 2 + 1] = Math.round((cur + next) / 2)
  }
  return out
}

/** Recebe um frame `media.payload` (base64 mulaw 8kHz) e retorna PCM16 16kHz base64. */
export function mulawFrameToPcm16Base64(mulawBase64: string): string {
  const mulaw = Buffer.from(mulawBase64, 'base64')
  const pcm8k = decodeMulawToPcm16(mulaw)
  const pcm16k = upsample2x(pcm8k)
  return Buffer.from(pcm16k.buffer, pcm16k.byteOffset, pcm16k.byteLength).toString('base64')
}

export interface TwilioMediaEvent {
  event: 'connected' | 'start' | 'media' | 'stop' | string
  streamSid?: string
  start?: { callSid?: string; customParameters?: Record<string, string> }
  media?: { track?: 'inbound' | 'outbound'; payload?: string }
}

export function parseTwilioMediaMessage(raw: string): TwilioMediaEvent | null {
  try {
    return JSON.parse(raw) as TwilioMediaEvent
  } catch {
    return null
  }
}
