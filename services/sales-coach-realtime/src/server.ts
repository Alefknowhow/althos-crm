/**
 * Serviço realtime do IA Sales Coach (Railway).
 *
 * Ponte WebSocket persistente: Browser (mic+aba mixados) → este serviço →
 * ElevenLabs Scribe v2 Realtime. Existe fora do Vercel porque uma função
 * serverless não sustenta uma conexão WebSocket de longa duração (mesmo gap
 * documentado, e nunca resolvido, para o Voice AI — ver
 * lib/voice/ai-conversation.ts no repo principal).
 *
 * O browser NUNCA fala direto com a ElevenLabs nem tem a API key: ele recebe
 * um token de sessão de curta duração (assinado, ver session-token.ts)
 * emitido pelo Next.js em app/api/sales-coach/realtime-token/route.ts, e
 * conecta aqui em `wss://<host>/session?token=...`.
 */
import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { verifySessionToken } from './session-token.js'
import { ElevenLabsRealtimeProvider } from './speech-to-text-provider.js'
import {
  getSupabaseAdmin, insertTranscriptSegment, markSessionEnded, markSessionLive,
  getAssistedSession, markAssistedSessionLive, markAssistedSessionEnded, insertAssistedTranscriptSegment,
} from './supabase.js'
import { mulawFrameToPcm16Base64, parseTwilioMediaMessage } from './twilio-media-adapter.js'
import { translateToPortuguese } from './translate.js'

const PORT = Number(process.env.PORT || 8080)
const REALTIME_SECRET = process.env.SALES_COACH_REALTIME_SECRET || ''
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ''

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server: httpServer, path: '/session' })

wss.on('connection', async (browserSocket, req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const token = url.searchParams.get('token') || ''
  const payload = verifySessionToken(token, REALTIME_SECRET)

  if (!payload) {
    browserSocket.close(4401, 'invalid_or_expired_token')
    return
  }

  const { sessionId, organizationId } = payload

  // Confirma que a sessão existe, pertence à org do token e ainda não
  // terminou — nunca confia só na assinatura do token para decidir estado.
  const supabase = getSupabaseAdmin()
  const { data: session, error } = await supabase
    .from('sales_coach_sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error || !session || session.status === 'ended' || session.status === 'failed') {
    browserSocket.close(4404, 'session_not_found_or_finished')
    return
  }

  const startedAt = Date.now()
  await markSessionLive(sessionId, organizationId)

  let sttConnection: Awaited<ReturnType<ElevenLabsRealtimeProvider['connect']>> | null = null
  let endedGracefully = false

  async function endSession(status: 'ended' | 'failed') {
    if (endedGracefully) return
    endedGracefully = true
    sttConnection?.close()
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
    await markSessionEnded(sessionId, organizationId, { status, durationSeconds }).catch((err) => {
      console.error('[sales-coach-realtime] falha ao marcar sessão encerrada', sessionId, err)
    })
  }

  try {
    const provider = new ElevenLabsRealtimeProvider(ELEVENLABS_API_KEY)
    sttConnection = await provider.connect({ languageCode: 'pt', keyterms: [] })

    let lastCommittedText = ''
    sttConnection.onTranscript((event) => {
      if (event.type === 'committed' && event.text === lastCommittedText) {
        // Defesa extra contra duplicata (além do filtro de message_type em
        // speech-to-text-provider.ts) — nunca repete o mesmo texto final
        // duas vezes seguidas pro browser nem pro banco.
        return
      }
      if (event.type === 'committed') lastCommittedText = event.text

      if (browserSocket.readyState === WebSocket.OPEN) {
        browserSocket.send(JSON.stringify({ type: event.type, text: event.text, speakerId: event.speakerId }))
      }
      if (event.type === 'committed') {
        insertTranscriptSegment({
          organizationId,
          sessionId,
          speaker: event.speakerId,
          text: event.text,
          isFinal: true,
          startedAtMs: event.startMs,
          endedAtMs: event.endMs,
        }).catch((err) => console.error('[sales-coach-realtime] falha ao persistir segmento', sessionId, err))
      }
    })

    sttConnection.onError((err) => {
      console.error('[sales-coach-realtime] erro ElevenLabs', sessionId, err)
      if (browserSocket.readyState === WebSocket.OPEN) {
        browserSocket.send(JSON.stringify({ type: 'error', message: 'transcription_provider_error' }))
      }
    })

    sttConnection.onClose((code, reason) => {
      console.log('[sales-coach-realtime] STT provider fechou a conexão', sessionId, code, reason)
      void endSession('ended')
    })
  } catch (err) {
    console.error('[sales-coach-realtime] falha ao conectar ao provider de STT', sessionId, err)
    browserSocket.close(1011, 'stt_provider_unavailable')
    await endSession('failed')
    return
  }

  let browserChunkCount = 0
  browserSocket.on('message', (raw) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type === 'audio_chunk' && typeof msg.audio_base64 === 'string') {
      browserChunkCount++
      if (browserChunkCount === 1) {
        console.log('[sales-coach-realtime] primeiro chunk de áudio recebido do browser', sessionId)
      }
      sttConnection?.sendAudioChunk(msg.audio_base64)
    } else if (msg.type === 'end') {
      browserSocket.close(1000, 'client_ended')
    }
  })

  browserSocket.on('close', () => {
    void endSession('ended')
  })

  browserSocket.on('error', (err) => {
    console.error('[sales-coach-realtime] erro no socket do browser', sessionId, err)
    void endSession('failed')
  })
})

/**
 * Chamada assistida (Voice → CallDialerModal, modo "assistida") — reaproveita
 * este mesmo serviço, com duas rotas novas: a Twilio conecta em
 * `/twilio-media` (Media Stream anexado à chamada via
 * lib/voice/providers/twilio.ts::startMediaStream) e o browser do vendedor
 * conecta em `/assist-chat` para receber a transcrição traduzida em tempo
 * real. Duas conexões STT por sessão (uma por perna da chamada: agente em
 * pt-BR, fornecedor no idioma-alvo) — só a fala do fornecedor é traduzida.
 */

const assistChatSockets = new Map<string, Set<WebSocket>>()

function sendToAssistChat(sessionId: string, payload: unknown) {
  const sockets = assistChatSockets.get(sessionId)
  if (!sockets || sockets.size === 0) return
  const msg = JSON.stringify(payload)
  for (const s of Array.from(sockets)) if (s.readyState === WebSocket.OPEN) s.send(msg)
}

const assistChatWss = new WebSocketServer({ server: httpServer, path: '/assist-chat' })

assistChatWss.on('connection', (browserSocket, req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const token = url.searchParams.get('token') || ''
  const payload = verifySessionToken(token, REALTIME_SECRET)
  if (!payload) { browserSocket.close(4401, 'invalid_or_expired_token'); return }

  const { sessionId } = payload
  let sockets = assistChatSockets.get(sessionId)
  if (!sockets) { sockets = new Set(); assistChatSockets.set(sessionId, sockets) }
  sockets.add(browserSocket)

  browserSocket.on('message', (raw) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw.toString()) } catch { return }
    // Orientação digitada pelo vendedor durante a ligação — repassada só
    // pra outras abas/viewers da mesma sessão (não há síntese de voz de
    // volta pra ligação nesta fase, por decisão de produto).
    if (msg.type === 'guidance' && typeof msg.text === 'string') {
      const others = assistChatSockets.get(sessionId)
      if (!others) return
      for (const s of Array.from(others)) {
        if (s !== browserSocket && s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify({ type: 'guidance', text: msg.text }))
        }
      }
    }
  })

  browserSocket.on('close', () => {
    const set = assistChatSockets.get(sessionId)
    set?.delete(browserSocket)
    if (set && set.size === 0) assistChatSockets.delete(sessionId)
  })
})

const twilioMediaWss = new WebSocketServer({ server: httpServer, path: '/twilio-media' })

twilioMediaWss.on('connection', async (twilioSocket, req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const token = url.searchParams.get('token') || ''
  const payload = verifySessionToken(token, REALTIME_SECRET)
  if (!payload) { twilioSocket.close(4401, 'invalid_or_expired_token'); return }

  const { sessionId, organizationId } = payload
  const session = await getAssistedSession(sessionId, organizationId)
  if (!session) { twilioSocket.close(4404, 'session_not_found'); return }

  const startedAt = Date.now()
  await markAssistedSessionLive(sessionId, organizationId)

  let agentStt: Awaited<ReturnType<ElevenLabsRealtimeProvider['connect']>> | null = null
  let supplierStt: Awaited<ReturnType<ElevenLabsRealtimeProvider['connect']>> | null = null
  let ended = false

  async function endMedia(status: 'ended' | 'failed') {
    if (ended) return
    ended = true
    agentStt?.close()
    supplierStt?.close()
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
    await markAssistedSessionEnded(sessionId, organizationId, { status, durationSeconds }).catch((err) => {
      console.error('[voice-assist] falha ao marcar sessão encerrada', sessionId, err)
    })
    sendToAssistChat(sessionId, { type: 'session_ended' })
  }

  try {
    const targetLanguage = session.target_language || 'en'

    agentStt = await new ElevenLabsRealtimeProvider(ELEVENLABS_API_KEY).connect({ languageCode: 'pt', keyterms: [] })
    agentStt.onTranscript((event) => {
      if (event.type !== 'committed') return
      sendToAssistChat(sessionId, { type: 'segment', speaker: 'agent', text: event.text })
      insertAssistedTranscriptSegment({
        organizationId, sessionId, speaker: 'agent', originalText: event.text, originalLanguage: 'pt',
        startedAtMs: event.startMs, endedAtMs: event.endMs,
      }).catch((err) => console.error('[voice-assist] falha ao persistir segmento (agente)', sessionId, err))
    })
    agentStt.onError((err) => console.error('[voice-assist] erro STT (agente)', sessionId, err))

    supplierStt = await new ElevenLabsRealtimeProvider(ELEVENLABS_API_KEY).connect({ languageCode: targetLanguage, keyterms: [] })
    supplierStt.onTranscript((event) => {
      if (event.type !== 'committed') return
      void (async () => {
        const translated = await translateToPortuguese(event.text, targetLanguage)
        sendToAssistChat(sessionId, { type: 'segment', speaker: 'supplier', text: event.text, translatedText: translated })
        await insertAssistedTranscriptSegment({
          organizationId, sessionId, speaker: 'supplier', originalText: event.text, originalLanguage: targetLanguage,
          translatedText: translated, startedAtMs: event.startMs, endedAtMs: event.endMs,
        }).catch((err) => console.error('[voice-assist] falha ao persistir segmento (fornecedor)', sessionId, err))
      })()
    })
    supplierStt.onError((err) => console.error('[voice-assist] erro STT (fornecedor)', sessionId, err))
  } catch (err) {
    console.error('[voice-assist] falha ao conectar ao provider de STT', sessionId, err)
    twilioSocket.close(1011, 'stt_provider_unavailable')
    await endMedia('failed')
    return
  }

  twilioSocket.on('message', (raw) => {
    const evt = parseTwilioMediaMessage(raw.toString())
    if (!evt) return
    if (evt.event === 'media' && evt.media?.payload) {
      const pcm16Base64 = mulawFrameToPcm16Base64(evt.media.payload)
      // 'inbound' = áudio chegando a esta perna (o outro lado — fornecedor);
      // 'outbound' = áudio que esta perna envia (o agente humano). Convenção
      // da Twilio para a perna onde o Stream foi anexado — a confirmar no
      // teste real de ponta a ponta (ver plano da Fase 6).
      if (evt.media.track === 'inbound') supplierStt?.sendAudioChunk(pcm16Base64)
      else if (evt.media.track === 'outbound') agentStt?.sendAudioChunk(pcm16Base64)
    } else if (evt.event === 'stop') {
      twilioSocket.close(1000, 'stream_stopped')
    }
  })

  twilioSocket.on('close', () => { void endMedia('ended') })
  twilioSocket.on('error', (err) => {
    console.error('[voice-assist] erro no socket de mídia da Twilio', sessionId, err)
    void endMedia('failed')
  })
})

httpServer.listen(PORT, () => {
  console.log(`[sales-coach-realtime] ouvindo na porta ${PORT}`)
})
