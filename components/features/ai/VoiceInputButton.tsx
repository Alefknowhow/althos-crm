'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Mic, Loader2, Trash2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { transcribeAudio } from '@/actions/speech-to-text'

const BAR_COUNT = 28

/**
 * Botão de microfone reutilizável — grava um áudio curto e transcreve via
 * ElevenLabs (actions/speech-to-text.ts), entregando o texto pro caller via
 * `onTranscribed`. Mesma mecânica de gravação do Copiloto
 * (CopilotDock.tsx), extraída aqui pra todo agente de IA do app usar
 * (Criar Formulário com IA, Testar Agente, Marketing Strategist, etc.)
 * sem duplicar a lógica de MediaRecorder em cada tela.
 *
 * Enquanto grava, sobrepõe a linha inteira (precisa de um ancestral
 * `relative`) com uma barra estilo WhatsApp: ondas reagindo ao volume real
 * do microfone (Web Audio API), cronômetro, cancelar e enviar.
 */
export function VoiceInputButton({
  orgSlug, onTranscribed, disabled, className,
}: {
  orgSlug: string
  onTranscribed: (text: string) => void
  disabled?: boolean
  className?: string
}) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(4))

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const barsRef = useRef<number[]>(Array(BAR_COUNT).fill(4))
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const paintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  function stopAnalysis() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (paintTimerRef.current) clearInterval(paintTimerRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    rafRef.current = null
    paintTimerRef.current = null
    timerRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
  }

  useEffect(() => () => stopAnalysis(), [])

  async function startRecording() {
    if (recording || transcribing || disabled) return
    cancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        stopAnalysis()
        setRecording(false)
        setSeconds(0)
        if (cancelledRef.current) return
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'audio.webm')
          const res = await transcribeAudio(orgSlug, fd)
          if (!res.ok) { toast.error('Não foi possível transcrever', { description: res.error }); return }
          onTranscribed(res.text)
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setSeconds(0)

      // Ondas reagindo ao volume real do microfone — amostra o sinal em
      // rAF (barato, não re-renderiza) e pinta o state a cada ~80ms.
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx = new AudioCtx()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)

      const sample = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(data)
        const step = Math.max(1, Math.floor(data.length / BAR_COUNT))
        const next: number[] = []
        for (let i = 0; i < BAR_COUNT; i++) {
          const v = data[i * step] || 0
          next.push(4 + Math.round((v / 255) * 22))
        }
        barsRef.current = next
        rafRef.current = requestAnimationFrame(sample)
      }
      sample()
      paintTimerRef.current = setInterval(() => setBars([...barsRef.current]), 80)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      toast.error('Não foi possível acessar o microfone')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  function cancelRecording() {
    cancelledRef.current = true
    mediaRecorderRef.current?.stop()
  }

  if (recording) {
    return (
      <div className="absolute inset-0 z-10 bg-background flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={cancelRecording}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted text-destructive"
          title="Cancelar gravação"
          aria-label="Cancelar gravação"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center gap-2 min-w-0 bg-muted rounded-full px-3.5 h-9">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="tabular-nums text-xs font-medium text-red-500 shrink-0">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </span>
          <div className="flex-1 flex items-center gap-[2px] overflow-hidden h-full">
            {bars.map((h, i) => (
              <span key={i} className="w-[2.5px] rounded-full bg-primary/60 shrink-0" style={{ height: `${h}px` }} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={stopRecording}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
          title="Enviar áudio"
          aria-label="Enviar áudio"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={disabled || transcribing}
      onClick={startRecording}
      title="Gravar áudio"
      aria-label="Gravar áudio"
      className={cn('shrink-0', className)}
    >
      {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
    </Button>
  )
}
