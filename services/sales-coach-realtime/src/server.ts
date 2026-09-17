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
import { getSupabaseAdmin, insertTranscriptSegment, markSessionEnded, markSessionLive } from './supabase.js'

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

    sttConnection.onTranscript((event) => {
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

    sttConnection.onClose(() => {
      void endSession('ended')
    })
  } catch (err) {
    console.error('[sales-coach-realtime] falha ao conectar ao provider de STT', sessionId, err)
    browserSocket.close(1011, 'stt_provider_unavailable')
    await endSession('failed')
    return
  }

  browserSocket.on('message', (raw) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type === 'audio_chunk' && typeof msg.audio_base64 === 'string') {
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

httpServer.listen(PORT, () => {
  console.log(`[sales-coach-realtime] ouvindo na porta ${PORT}`)
})
