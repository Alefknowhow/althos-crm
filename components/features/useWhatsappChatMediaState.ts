import { useState, useEffect, useRef } from 'react'
import { sendWhatsappMedia } from '@/actions/whatsapp'
import { toast } from 'sonner'

// Estado + handlers de mídia (imagens em revisão, upload, gravação de áudio)
// do WhatsappChat — extraído de useWhatsappChatState.ts pra manter os
// arquivos de estado abaixo do limite de linhas. Pura movimentação de código.
export function useWhatsappChatMediaState({ orgSlug, selectedConversation }: any) {
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerFileInputRef = useRef<HTMLInputElement>(null)
  const opusRecorderRef = useRef<any>(null)
  // Fila de imagens em revisão antes de enviar (colar/arrastar/selecionar
  // abre essa janela em vez de mandar direto, igual o WhatsApp normal).
  const [pendingImages, setPendingImages] = useState<{ file: File; caption: string; previewUrl: string }[]>([])
  const [composerIndex, setComposerIndex] = useState(0)
  const [sendingQueue, setSendingQueue] = useState(false)
  const [editingImage, setEditingImage] = useState(false)

  async function uploadAndSend(file: File, caption?: string) {
    if (!selectedConversation) return
    setUploadingMedia(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (caption?.trim()) fd.append('caption', caption.trim())
      const res = await sendWhatsappMedia(orgSlug, selectedConversation.id, fd)
      if (!res.ok) toast.error('Não foi possível enviar', { description: res.error })
    } finally {
      setUploadingMedia(false)
    }
  }

  // Áudio continua indo direto (sem revisão) — só imagem abre a janela de
  // pré-visualização, igual o WhatsApp normal.
  function queueImages(files: File[]) {
    const valid = files.filter(f => {
      if (f.size > 20 * 1024 * 1024) { toast.error(`"${f.name}" é muito grande (máx 20MB).`); return false }
      return true
    })
    if (valid.length === 0) return
    setPendingImages(prev => {
      const added = valid.map(file => ({ file, caption: '', previewUrl: URL.createObjectURL(file) }))
      const next = [...prev, ...added]
      setComposerIndex(next.length - added.length) // foca na primeira recém-adicionada
      return next
    })
  }

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    queueImages(files)
  }

  function handleComposerAddMore(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    queueImages(files)
  }

  function removePendingImage(index: number) {
    setPendingImages(prev => {
      URL.revokeObjectURL(prev[index].previewUrl)
      const next = prev.filter((_, i) => i !== index)
      setComposerIndex(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }

  function closeImageComposer() {
    pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl))
    setPendingImages([])
    setComposerIndex(0)
    setEditingImage(false)
  }

  function handleApplyEditedImage(edited: File) {
    setPendingImages(prev => {
      const old = prev[composerIndex]
      if (old) URL.revokeObjectURL(old.previewUrl)
      const next = [...prev]
      next[composerIndex] = { ...old, file: edited, previewUrl: URL.createObjectURL(edited) }
      return next
    })
    setEditingImage(false)
  }

  async function handleSendImageQueue() {
    if (pendingImages.length === 0) return
    setSendingQueue(true)
    try {
      for (const p of pendingImages) {
        await uploadAndSend(p.file, p.caption)
      }
    } finally {
      setSendingQueue(false)
      closeImageComposer()
    }
  }

  // Grava em Ogg Opus de verdade (via opus-recorder, WASM) — o WhatsApp
  // rejeita audio/webm (o formato nativo do MediaRecorder do navegador),
  // só aceita AAC, MP3, AMR ou OGG/Opus.
  async function handleMicClick() {
    if (recording) return // enquanto grava, os controles são os da barra (pausar/cancelar/enviar)
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Gravação de áudio não é suportada neste navegador.')
      return
    }
    try {
      const { default: Recorder } = await import('opus-recorder')
      const rec = new Recorder({ encoderPath: '/encoderWorker.min.js', numberOfChannels: 1, streamPages: false })
      rec.ondataavailable = (arrayBuffer: ArrayBuffer) => {
        const blob = new Blob([arrayBuffer], { type: 'audio/ogg' })
        if (blob.size > 0) {
          const file = new File([blob], `audio-${Date.now()}.ogg`, { type: 'audio/ogg' })
          uploadAndSend(file)
        }
      }
      await rec.start()
      opusRecorderRef.current = rec
      setRecording(true)
      setRecordingPaused(false)
      setRecordingSeconds(0)
    } catch (e: any) {
      console.error('[gravação de áudio]', e)
      const isPermission = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError'
      toast.error(
        isPermission
          ? 'Não foi possível acessar o microfone. Verifique a permissão do navegador.'
          : `Não foi possível iniciar a gravação: ${e?.message || e?.name || 'erro desconhecido'}`,
      )
    }
  }

  function handleRecordingPauseToggle() {
    const rec = opusRecorderRef.current
    if (!rec) return
    if (recordingPaused) { rec.resume(); setRecordingPaused(false) }
    else { rec.pause(); setRecordingPaused(true) }
  }

  function handleCancelRecording() {
    const rec = opusRecorderRef.current
    if (!rec) return
    rec.ondataavailable = () => {} // descarta — não chama uploadAndSend
    rec.stop()
    opusRecorderRef.current = null
    setRecording(false)
    setRecordingPaused(false)
  }

  function handleSendRecording() {
    const rec = opusRecorderRef.current
    if (!rec) return
    rec.stop() // dispara ondataavailable já configurado, que envia
    opusRecorderRef.current = null
    setRecording(false)
    setRecordingPaused(false)
  }

  // Timer da gravação em andamento.
  useEffect(() => {
    if (!recording || recordingPaused) return
    const id = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording, recordingPaused])

  // Colar imagem (Ctrl+V) direto na conversa aberta.
  useEffect(() => {
    if (!selectedConversation) return
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.items || [])
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((f): f is File => !!f)
      if (files.length === 0) return
      e.preventDefault()
      queueImages(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id])

  return {
    uploadingMedia, recording, recordingPaused, recordingSeconds, fileInputRef, composerFileInputRef,
    pendingImages, setPendingImages, composerIndex, setComposerIndex, sendingQueue, editingImage,
    setEditingImage, queueImages, handleImageSelected, handleComposerAddMore, removePendingImage,
    closeImageComposer, handleApplyEditedImage, handleSendImageQueue, handleMicClick,
    handleRecordingPauseToggle, handleCancelRecording, handleSendRecording,
  }
}
