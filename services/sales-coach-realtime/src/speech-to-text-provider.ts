/**
 * Abstração de STT realtime (Fase 1: só ElevenLabs). Nenhum outro módulo do
 * Sales Coach deve importar `ws`/ElevenLabs diretamente — só através desta
 * interface, para permitir trocar de provider (Deepgram, OpenAI) no futuro
 * sem reescrever o resto do pipeline (spec § 6).
 */
import WebSocket from 'ws'

export interface TranscriptEvent {
  type: 'partial' | 'committed'
  text: string
  speakerId?: string
  startMs?: number
  endMs?: number
}

export interface SpeechToTextConnection {
  sendAudioChunk(base64Pcm16: string): void
  close(): void
  onTranscript(cb: (event: TranscriptEvent) => void): void
  onError(cb: (err: Error) => void): void
  onClose(cb: (code: number, reason: string) => void): void
}

export interface SpeechToTextProvider {
  connect(opts: { languageCode: string; keyterms: string[] }): Promise<SpeechToTextConnection>
}

const ELEVENLABS_REALTIME_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime'

export class ElevenLabsRealtimeProvider implements SpeechToTextProvider {
  constructor(private readonly apiKey: string) {}

  async connect(opts: { languageCode: string; keyterms: string[] }): Promise<SpeechToTextConnection> {
    if (!this.apiKey) throw new Error('ELEVENLABS_API_KEY ausente no serviço realtime.')

    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      audio_format: 'pcm_16000',
      language_code: opts.languageCode || 'pt',
      commit_strategy: 'vad',
      include_timestamps: 'true',
    })
    if (opts.keyterms.length > 0) {
      params.set('keyterms', opts.keyterms.join(','))
    }

    // Roda inteiramente no servidor (nunca no browser) — pode usar a chave
    // fixa direto no header, sem precisar do single-use token de 15min que a
    // ElevenLabs documenta para uso client-side.
    const ws = new WebSocket(`${ELEVENLABS_REALTIME_URL}?${params.toString()}`, {
      headers: { 'xi-api-key': this.apiKey },
    })

    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })

    const transcriptCbs: ((event: TranscriptEvent) => void)[] = []
    const errorCbs: ((err: Error) => void)[] = []
    const closeCbs: ((code: number, reason: string) => void)[] = []

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      const type = msg.message_type as string | undefined
      if (type === 'partial_transcript' && typeof msg.text === 'string') {
        for (const cb of transcriptCbs) cb({ type: 'partial', text: msg.text })
      } else if (
        // Sempre pedimos include_timestamps:true — a ElevenLabs manda os DOIS
        // tipos (`committed_transcript` e `committed_transcript_with_timestamps`)
        // pro mesmo trecho quando isso está ligado. Tratar os dois como
        // "committed" causava duplicação (achado real em produção,
        // 2026-09-17) — só o variant com timestamps é processado.
        type === 'committed_transcript_with_timestamps' &&
        typeof msg.text === 'string'
      ) {
        for (const cb of transcriptCbs) {
          cb({
            type: 'committed',
            text: msg.text,
            speakerId: typeof msg.speaker_id === 'string' ? msg.speaker_id : undefined,
            startMs: typeof msg.start_ms === 'number' ? msg.start_ms : undefined,
            endMs: typeof msg.end_ms === 'number' ? msg.end_ms : undefined,
          })
        }
      } else if (type && type.endsWith('_error')) {
        for (const cb of errorCbs) cb(new Error(`ElevenLabs realtime error: ${type} — ${JSON.stringify(msg)}`))
      }
    })

    ws.on('error', (err) => {
      for (const cb of errorCbs) cb(err instanceof Error ? err : new Error(String(err)))
    })

    ws.on('close', (code, reasonBuf) => {
      const reason = reasonBuf?.toString() || ''
      console.log('[elevenlabs] conexão fechada', code, reason)
      for (const cb of closeCbs) cb(code, reason)
    })

    let chunkCount = 0
    return {
      sendAudioChunk(base64Pcm16: string) {
        if (ws.readyState !== WebSocket.OPEN) return
        chunkCount++
        if (chunkCount === 1 || chunkCount % 50 === 0) {
          console.log('[elevenlabs] chunks de áudio enviados até agora:', chunkCount)
        }
        ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: base64Pcm16 }))
      },
      close() {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close()
      },
      onTranscript(cb) {
        transcriptCbs.push(cb)
      },
      onError(cb) {
        errorCbs.push(cb)
      },
      onClose(cb) {
        closeCbs.push(cb)
      },
    }
  }
}
