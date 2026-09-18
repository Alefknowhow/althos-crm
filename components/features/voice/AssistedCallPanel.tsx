'use client'

/**
 * Painel de chamada assistida — mostrado ao lado da ActiveCallBar quando a
 * ligação em andamento foi iniciada no modo "Assistida" (CallDialerModal).
 * Conecta no serviço realtime (services/sales-coach-realtime, rota
 * /assist-chat) e mostra a transcrição traduzida em tempo real do outro
 * lado da ligação, com um campo pra orientar (texto — sem síntese de voz de
 * volta pra ligação, decisão de produto).
 */

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Languages, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startAssistedCallSession, endAssistedCallSession, ASSISTED_CALL_LANGUAGES } from '@/actions/voice'

interface Segment {
  id: string
  speaker: 'supplier' | 'agent'
  text: string
  translatedText?: string
}

type Status = 'idle' | 'connecting' | 'live' | 'ended' | 'error'

export function AssistedCallPanel({ orgSlug, voiceCallId, targetLanguage }: { orgSlug: string; voiceCallId: string; targetLanguage: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [segments, setSegments] = useState<Segment[]>([])
  const [guidance, setGuidance] = useState('')
  const sessionIdRef = useRef<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const languageLabel = ASSISTED_CALL_LANGUAGES.find(l => l.value === targetLanguage)?.label || targetLanguage

  useEffect(() => {
    return () => {
      socketRef.current?.close()
      if (sessionIdRef.current) endAssistedCallSession(orgSlug, sessionIdRef.current).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [segments])

  async function connect() {
    setStatus('connecting')
    const res = await startAssistedCallSession(orgSlug, voiceCallId, targetLanguage)
    if (!res.ok) {
      toast.error(res.error)
      setStatus('error')
      return
    }
    sessionIdRef.current = res.sessionId
    const socket = new WebSocket(res.wsUrl)
    socketRef.current = socket

    socket.onopen = () => setStatus('live')
    socket.onerror = () => setStatus('error')
    socket.onclose = () => setStatus(prev => (prev === 'live' ? 'ended' : prev))
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'segment') {
          setSegments(prev => [...prev, { id: `${Date.now()}-${prev.length}`, speaker: msg.speaker, text: msg.text, translatedText: msg.translatedText }])
        } else if (msg.type === 'session_ended') {
          setStatus('ended')
        }
      } catch {
        // ignore
      }
    }
  }

  function sendGuidance() {
    if (!guidance.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ type: 'guidance', text: guidance.trim() }))
    setSegments(prev => [...prev, { id: `${Date.now()}-guidance`, speaker: 'agent', text: `[orientação] ${guidance.trim()}` }])
    setGuidance('')
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 w-80 rounded-2xl border bg-card shadow-lg flex flex-col max-h-[420px]">
      <div className="px-3.5 py-2.5 border-b flex items-center gap-1.5">
        <Languages className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Chamada assistida</span>
        <span className="text-xs text-muted-foreground ml-auto">{languageLabel} → PT-BR</span>
      </div>

      {status === 'idle' && (
        <div className="p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Conecte quando a ligação estiver atendida para começar a transcrição traduzida.</p>
          <Button size="sm" className="w-full" onClick={connect}>Conectar assistência</Button>
        </div>
      )}

      {status === 'connecting' && (
        <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Conectando...
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 text-center space-y-2">
          <p className="text-xs text-destructive">Não foi possível conectar a assistência.</p>
          <Button size="sm" variant="outline" className="w-full" onClick={connect}>Tentar novamente</Button>
        </div>
      )}

      {(status === 'live' || status === 'ended') && (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px]">
            {segments.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Aguardando fala...</p>}
            {segments.map(s => (
              <div key={s.id} className={`text-xs rounded-lg p-2 ${s.speaker === 'supplier' ? 'bg-muted' : 'bg-primary/10'}`}>
                <div className="font-medium mb-0.5">{s.speaker === 'supplier' ? 'Fornecedor' : 'Você'}</div>
                {s.speaker === 'supplier' ? (
                  <>
                    <p>{s.translatedText || s.text}</p>
                    {s.translatedText && s.translatedText !== s.text && (
                      <p className="text-muted-foreground italic mt-0.5">"{s.text}"</p>
                    )}
                  </>
                ) : (
                  <p>{s.text}</p>
                )}
              </div>
            ))}
            {status === 'ended' && <p className="text-xs text-muted-foreground text-center py-2">Sessão encerrada.</p>}
          </div>
          {status === 'live' && (
            <div className="p-2.5 border-t flex gap-1.5">
              <input
                value={guidance}
                onChange={e => setGuidance(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendGuidance()}
                placeholder="Orientar (nota só sua)..."
                className="flex-1 rounded-md border border-input bg-input/25 px-2 py-1.5 text-xs"
              />
              <Button size="sm" variant="outline" onClick={sendGuidance} disabled={!guidance.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
