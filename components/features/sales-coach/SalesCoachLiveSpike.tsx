'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Radio, Square, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AudioCaptureError, startMixedAudioCapture, type AudioCaptureHandle } from '@/lib/sales-coach/browser-audio'
import { SalesCoachLivePanel } from './SalesCoachLivePanel'
import { emptySalesContext, type SalesContext, type SalesEvent, type TranscriptSegmentInput } from '@/lib/sales-coach/types'
import type { NextBestAction } from '@/lib/sales-coach/next-best-action'

type Status = 'idle' | 'starting' | 'live' | 'ended' | 'error'

interface TranscriptLine {
  id: number
  text: string
  isFinal: boolean
}

// Cadência do loop que liga a transcrição às engines (spec §14: nunca por
// partial, sempre por intervalo controlado). A cada TURN_INTERVAL_MS, se
// houver trechos finais novos acumulados, processa um "turno". Next Best
// Action (modelo mais caro) só a cada NBA_EVERY_N_TURNS turnos.
const TURN_INTERVAL_MS = 12_000
const NBA_EVERY_N_TURNS = 2

/**
 * Sales Coach Live (spec §20/21) — captura de mic + aba da reunião,
 * transcrição em tempo real via o serviço realtime (Railway), e o painel
 * de decisão (Sales Context Engine + Sales Event Engine + Next Best
 * Action, ligados ao vivo — fatia 5).
 */
export function SalesCoachLiveSpike({ orgSlug }: { orgSlug: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [context, setContext] = useState<SalesContext | null>(null)
  const [events, setEvents] = useState<SalesEvent[]>([])
  const [nextBestAction, setNextBestAction] = useState<NextBestAction | null>(null)
  const partialLineIdRef = useRef<number | null>(null)
  const lineCounterRef = useRef(0)
  const audioHandleRef = useRef<AudioCaptureHandle | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const pendingSegmentsRef = useRef<TranscriptSegmentInput[]>([])
  const contextRef = useRef<SalesContext>(emptySalesContext())
  const eventsRef = useRef<SalesEvent[]>([])
  const turnCounterRef = useRef(0)
  const turnInFlightRef = useRef(false)
  const turnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runTurn = useCallback(async () => {
    if (turnInFlightRef.current || pendingSegmentsRef.current.length === 0 || !sessionIdRef.current) return
    turnInFlightRef.current = true
    const segments = pendingSegmentsRef.current
    pendingSegmentsRef.current = []
    turnCounterRef.current += 1
    const wantNextBestAction = turnCounterRef.current % NBA_EVERY_N_TURNS === 0

    try {
      const res = await fetch('/api/sales-coach/process-turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgSlug,
          sessionId: sessionIdRef.current,
          newSegments: segments,
          previousContext: contextRef.current,
          existingEvents: eventsRef.current,
          wantNextBestAction,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.context) {
        contextRef.current = data.context
        setContext(data.context)
      }
      if (Array.isArray(data.newEvents) && data.newEvents.length > 0) {
        eventsRef.current = [...eventsRef.current, ...data.newEvents]
        setEvents(eventsRef.current)
      }
      if (data.nextBestAction) {
        setNextBestAction(data.nextBestAction)
      }
    } catch {
      // turno perdido não é crítico — o próximo intervalo tenta de novo com os segmentos acumulados
    } finally {
      turnInFlightRef.current = false
    }
  }, [orgSlug])

  useEffect(() => {
    if (status === 'live') {
      turnIntervalRef.current = setInterval(runTurn, TURN_INTERVAL_MS)
      return () => {
        if (turnIntervalRef.current) clearInterval(turnIntervalRef.current)
      }
    }
  }, [status, runTurn])

  const appendTranscript = useCallback((text: string, isFinal: boolean, speaker?: string) => {
    if (isFinal) {
      pendingSegmentsRef.current = [...pendingSegmentsRef.current, { speaker, text }]
    }
    setLines((prev) => {
      if (!isFinal) {
        // Substitui a última linha parcial em vez de acumular — evita
        // "bombardear" a UI (spec §3) e mantém só o rascunho mais recente.
        if (partialLineIdRef.current !== null) {
          return prev.map((l) => (l.id === partialLineIdRef.current ? { ...l, text } : l))
        }
        const id = ++lineCounterRef.current
        partialLineIdRef.current = id
        return [...prev, { id, text, isFinal: false }]
      }
      partialLineIdRef.current = null
      const id = ++lineCounterRef.current
      return [...prev, { id, text, isFinal: true }]
    })
  }, [])

  const stopEverything = useCallback((nextStatus: Status) => {
    audioHandleRef.current?.stop()
    audioHandleRef.current = null
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }))
      wsRef.current.close()
    }
    wsRef.current = null
    setStatus(nextStatus)
  }, [])

  const start = useCallback(async () => {
    setErrorMessage(null)
    setStatus('starting')
    setLines([])
    setContext(null)
    setEvents([])
    setNextBestAction(null)
    contextRef.current = emptySalesContext()
    eventsRef.current = []
    pendingSegmentsRef.current = []
    turnCounterRef.current = 0
    partialLineIdRef.current = null

    try {
      const res = await fetch('/api/sales-coach/realtime-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgSlug }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível iniciar a sessão.')
      }
      sessionIdRef.current = data.sessionId

      const ws = new WebSocket(data.wsUrl)
      wsRef.current = ws

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve()
        ws.onerror = () => reject(new Error('Falha ao conectar ao serviço de transcrição em tempo real.'))
      })

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'partial' && typeof msg.text === 'string') {
            appendTranscript(msg.text, false)
          } else if (msg.type === 'committed' && typeof msg.text === 'string') {
            appendTranscript(msg.text, true, typeof msg.speakerId === 'string' ? msg.speakerId : undefined)
          } else if (msg.type === 'error') {
            setErrorMessage('Erro no provedor de transcrição — a sessão continua, mas pode haver falhas.')
          }
        } catch {
          // ignora mensagem malformada
        }
      }

      ws.onclose = () => {
        setStatus((s) => (s === 'live' || s === 'starting' ? 'ended' : s))
        void runTurn()
      }

      const audioHandle = await startMixedAudioCapture((base64Pcm16) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio_chunk', audio_base64: base64Pcm16 }))
        }
      })
      audioHandleRef.current = audioHandle

      setStatus('live')
    } catch (err) {
      const message =
        err instanceof AudioCaptureError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Erro desconhecido ao iniciar o Sales Coach.'
      setErrorMessage(message)
      stopEverything('error')
    }
  }, [orgSlug, appendTranscript, stopEverything, runTurn])

  const stop = useCallback(() => stopEverything('ended'), [stopEverything])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status === 'live' ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                  AO VIVO
                </span>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  {status === 'idle' && 'Pronto para iniciar'}
                  {status === 'starting' && 'Conectando…'}
                  {status === 'ended' && 'Sessão encerrada'}
                  {status === 'error' && 'Erro'}
                </span>
              )}
            </div>
            {status !== 'live' && status !== 'starting' ? (
              <Button onClick={start}>
                <Mic className="w-4 h-4" /> Iniciar Sales Coach
              </Button>
            ) : (
              <Button variant="destructive" onClick={stop} disabled={status === 'starting'}>
                <Square className="w-4 h-4" /> Encerrar
              </Button>
            )}
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === 'idle' && (
            <p className="text-xs text-muted-foreground">
              Ao iniciar, o navegador vai pedir acesso ao microfone e pedir para você escolher a aba do
              Meet/Zoom/Teams para compartilhar — marque a opção &quot;Compartilhar áudio da aba&quot; na janela de
              seleção, senão o Sales Coach não ouve o outro participante.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
        <SalesCoachLivePanel context={context} events={events} nextBestAction={nextBestAction} />

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-1.5 text-sm font-medium mb-3">
              <Radio className="w-4 h-4" /> Transcrição
            </div>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">A transcrição aparece aqui assim que a call começar.</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {lines.map((line) => (
                  <p key={line.id} className={line.isFinal ? 'text-sm' : 'text-sm text-muted-foreground italic'}>
                    {line.text}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
