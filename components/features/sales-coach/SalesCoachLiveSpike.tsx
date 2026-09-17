'use client'

import { useCallback, useRef, useState } from 'react'
import { Mic, Radio, Square, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AudioCaptureError, startMixedAudioCapture, type AudioCaptureHandle } from '@/lib/sales-coach/browser-audio'

type Status = 'idle' | 'starting' | 'live' | 'ended' | 'error'

interface TranscriptLine {
  id: number
  text: string
  isFinal: boolean
}

/**
 * Spike técnico do IA Sales Coach (fatia 1) — prova ponta a ponta:
 * captura de mic + aba da reunião no browser → serviço realtime (Railway)
 * → ElevenLabs Scribe v2 Realtime → transcrição exibida aqui.
 *
 * NÃO é a UI final do Sales Coach Live (spec §20/21) — sem contexto
 * comercial, eventos, Next Best Action. Só valida a infra de áudio+socket
 * antes de investir nas fatias seguintes.
 */
export function SalesCoachLiveSpike({ orgSlug }: { orgSlug: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const partialLineIdRef = useRef<number | null>(null)
  const lineCounterRef = useRef(0)
  const audioHandleRef = useRef<AudioCaptureHandle | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const appendTranscript = useCallback((text: string, isFinal: boolean) => {
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
            appendTranscript(msg.text, true)
          } else if (msg.type === 'error') {
            setErrorMessage('Erro no provedor de transcrição — a sessão continua, mas pode haver falhas.')
          }
        } catch {
          // ignora mensagem malformada
        }
      }

      ws.onclose = () => {
        setStatus((s) => (s === 'live' || s === 'starting' ? 'ended' : s))
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
  }, [orgSlug, appendTranscript, stopEverything])

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
  )
}
