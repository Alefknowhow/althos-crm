'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { transcribeAudio } from '@/actions/speech-to-text'

/**
 * Botão de microfone reutilizável — grava um áudio curto e transcreve via
 * ElevenLabs (actions/speech-to-text.ts), entregando o texto pro caller via
 * `onTranscribed`. Mesma mecânica de gravação do Copiloto
 * (CopilotDock.tsx), extraída aqui pra todo agente de IA do app usar
 * (Criar Formulário com IA, Testar Agente, Marketing Strategist, etc.)
 * sem duplicar a lógica de MediaRecorder em cada tela.
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  async function startRecording() {
    if (recording || transcribing || disabled) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
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
    } catch {
      toast.error('Não foi possível acessar o microfone')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={recording ? 'destructive' : 'ghost'}
      disabled={disabled || transcribing}
      onClick={recording ? stopRecording : startRecording}
      title={recording ? 'Parar gravação' : 'Gravar áudio'}
      aria-label={recording ? 'Parar gravação' : 'Gravar áudio'}
      className={cn('shrink-0', className)}
    >
      {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  )
}
