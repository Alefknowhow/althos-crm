import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { transcribeCopilotAudio } from '@/actions/copilot'

/**
 * Gravação + transcrição de áudio do microfone pro campo de input do
 * Copiloto — extraído de CopilotDock (que passou do limite de 350 linhas
 * do lint). Grava um áudio curto, transcreve via ElevenLabs
 * (actions/copilot.ts::transcribeCopilotAudio) e devolve o texto pro
 * caller anexar ao input; o usuário revê e envia como mensagem normal.
 */
export function useCopilotAudioRecording(orgSlug: string, onTranscribed: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  async function startRecording() {
    if (recording || transcribing) return
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
          const res = await transcribeCopilotAudio(orgSlug, fd)
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

  return { recording, transcribing, startRecording, stopRecording }
}
