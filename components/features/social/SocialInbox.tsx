'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  sendManualMessage,
  sendManualImageMessage,
  sendManualAudioMessage,
  uploadSocialMedia,
  toggleAutomationPause,
  markConversationRead,
  setSocialConversationArchived,
  setSocialConversationMuted,
  setSocialConversationPinned,
  setSocialConversationFavorite,
  setSocialConversationBlocked,
  markSocialConversationAsUnread,
  clearSocialConversationMessages,
  deleteSocialConversation,
  type SocialConversationRow,
  type SocialMessageRow,
} from '@/actions/social-inbox'
import ImageEditor from '@/components/features/ImageEditor'
import { MoreVertical, Archive, BellOff, Bell, Pin, PinOff, Star, MailQuestion, Eraser, Trash2, Ban, Plus, Send, Pencil, X, FileText } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// Conjunto enxuto de emojis comuns para atendimento (sem libs externas) —
// mesmo padrão usado no WhatsappChat.tsx.
const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤗','🤔','😅','😉','🙂','😇','🥳','😏',
  '👍','👎','👏','🙏','💪','🤝','👋','✌️','🤙','👌','🫶','💯','🔥','✨','⭐','🎉',
  '❤️','🧡','💛','💚','💙','💜','🤍','💔','😢','😭','😅','😡','😱','🤯','🥺','😴',
  '✅','❌','⚠️','📌','📎','📷','🎁','💰','💳','🛫','🏨','🌴','🗺️','📅','⏰','📞',
]

// Alturas fixas pra "forma de onda" decorativa da barra de gravação — mesma
// do WhatsappChat.tsx.
const WAVEFORM_BARS = Array.from({ length: 40 }, (_, i) => 6 + Math.round(10 * Math.abs(Math.sin(i * 0.7))))

function Avatar({ name, username, avatarUrl, size = 'md' }: { name: string | null; username: string | null; avatarUrl: string | null; size?: 'md' | 'lg' }) {
  const label = name || username || '?'
  const initials = label.slice(0, 2).toUpperCase()
  const dim = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={label} className={`${dim} rounded-full object-cover shrink-0`} />
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white flex items-center justify-center text-xs font-semibold shrink-0`}>
      {initials}
    </div>
  )
}

// Tick de confirmação ao lado do horário — mesmas regras do WhatsappChat,
// sem o estado "lida" (Instagram manda read/delivery mas não temos double-
// check azul específico no design daqui; reaproveita as mesmas cores).
function ConversationTicks({ status }: { status?: string | null }) {
  if (status === 'failed') {
    return <span title="Falha no envio" className="text-red-500 text-[11px] leading-none shrink-0">⚠</span>
  }
  if (!status || status === 'pending' || status === 'sending') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/60" aria-label="Enviando">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" />
      </svg>
    )
  }
  const isRead = status === 'read'
  const isDouble = status === 'delivered' || status === 'read'
  return (
    <svg
      width={isDouble ? 16 : 11}
      height="10"
      viewBox={isDouble ? '0 0 18 11' : '0 0 12 11'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${isRead ? 'text-sky-500' : 'text-muted-foreground/70'}`}
      aria-label={isRead ? 'Lida' : isDouble ? 'Entregue' : 'Enviada'}
    >
      <path d="M1 5.5 4.5 9 11 1.5" />
      {isDouble && <path d="M6 5.5 9.5 9 16 1.5" />}
    </svg>
  )
}

// Horário do inbox no estilo WhatsApp — mesma função do WhatsappChat.tsx.
function formatInboxTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days <= 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Ontem'
  if (days < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Renderiza a mídia de uma mensagem, dispatch por media_type.
function renderInstagramMedia(m: SocialMessageRow, onImageClick?: (url: string) => void): React.ReactNode {
  if (!m.media_url) return null
  const type = m.media_type || 'image'
  if (type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={m.media_url} alt="" className="max-w-full rounded-2xl mb-1 max-h-64 object-cover cursor-pointer"
        onClick={() => onImageClick?.(m.media_url!)}
      />
    )
  }
  if (type === 'video') {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video controls src={m.media_url} className="rounded-2xl max-w-full max-h-64 mb-1" />
  }
  if (type === 'audio') {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <audio controls src={m.media_url} className="max-w-[220px] mb-1" />
  }
  return (
    <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline mb-1">
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate">Documento</span>
    </a>
  )
}

type Props = {
  orgSlug: string
  orgId?: string
  conversations: SocialConversationRow[]
  selectedConversation: SocialConversationRow | null
  initialMessages: SocialMessageRow[]
  justConnected?: boolean
}

export default function SocialInbox({ orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages, justConnected }: Props) {
  // Lista ao vivo — semeada pelo server, atualizada em tempo real abaixo.
  const [conversations, setConversations] = useState(conversationsProp)
  useEffect(() => { setConversations(conversationsProp) }, [conversationsProp])
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [pausing, setPausing] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerFileInputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  // Envio de imagem (fila/composer) / gravação de áudio — mesmo padrão do
  // WhatsappChat.tsx.
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const opusRecorderRef = useRef<any>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [pendingImages, setPendingImages] = useState<{ file: File; caption: string; previewUrl: string }[]>([])
  const [composerIndex, setComposerIndex] = useState(0)
  const [sendingQueue, setSendingQueue] = useState(false)
  const [editingImage, setEditingImage] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Menu de opções da conversa (arquivar, silenciar, fixar, bloquear etc.)
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | 'block' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter(c => {
        // Arquivadas somem da lista principal — exceto a que está aberta.
        if (c.archived && c.id !== selectedConversation?.id) return false
        if (q) {
          const hay = `${c.sender_name || ''} ${c.sender_username || ''} ${c.last_message_preview || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  }, [conversations, query, selectedConversation])

  useEffect(() => {
    if (justConnected) {
      toast.success('Instagram conectado com sucesso!')
      router.replace(`/app/${orgSlug}/social/inbox`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnected])

  useEffect(() => {
    setMessages(initialMessages)
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markConversationRead(orgSlug, selectedConversation.id)
    }
  }, [initialMessages, selectedConversation, orgSlug])

  // Efeito separado, disparado por `messages` (já renderizado) em vez de
  // `initialMessages` — mesma correção do WhatsappChat.tsx: rolar no mesmo
  // efeito que ainda vai setar o estado usa o layout anterior, abrindo a
  // conversa nas mensagens antigas em vez das últimas.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, selectedConversation?.id])

  useEffect(() => {
    const conversationId = selectedConversation?.id
    if (!conversationId) return
    const channel = supabase
      .channel(`social_inbox_${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          setMessages(prev => [...prev, payload.new as SocialMessageRow])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
          markConversationRead(orgSlug, conversationId)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'social_messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          setMessages(prev => prev.map(m => m.id === (payload.new as any).id ? (payload.new as SocialMessageRow) : m))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedConversation?.id, orgSlug, supabase])

  // Lista de conversas ao vivo — mesmo padrão do WhatsappChat: qualquer
  // mensagem toca social_conversations no servidor, então escutando essa
  // tabela a lista reordena e mostra não-lido sem F5. Conversa nova (sem
  // join de perfil disponível no payload) só dispara um refresh silencioso.
  useEffect(() => {
    if (!orgId) return
    const channel = supabase.channel(`social_conv_list_${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'social_conversations', filter: `organization_id=eq.${orgId}` }, (payload) => {
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === (payload.new as any).id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...(payload.new as any) }
          next.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
          return next
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_conversations', filter: `organization_id=eq.${orgId}` }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId, supabase, router])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !selectedConversation) return
    setSending(true)
    const text = input
    setInput('')
    const res = await sendManualMessage(orgSlug, selectedConversation.id, text)
    if (!res.ok) {
      toast.error('Não foi possível enviar a mensagem', { description: res.error })
      setInput(text)
    } else {
      router.refresh()
    }
    setSending(false)
    inputRef.current?.focus()
  }

  async function uploadAndSend(file: File, caption?: string) {
    if (!selectedConversation) return
    setUploadingMedia(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploaded = await uploadSocialMedia(orgSlug, fd)
      if (!uploaded.ok) { toast.error('Não foi possível enviar', { description: uploaded.error }); return }
      const res = uploaded.kind === 'audio'
        ? await sendManualAudioMessage(orgSlug, selectedConversation.id, uploaded.url)
        : await sendManualImageMessage(orgSlug, selectedConversation.id, uploaded.url, caption)
      if (!res.ok) toast.error('Não foi possível enviar', { description: res.error })
      else router.refresh()
    } finally {
      setUploadingMedia(false)
    }
  }

  // Áudio vai direto (sem revisão); só imagem abre a janela de
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
      setComposerIndex(next.length - added.length)
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

  // Grava em Ogg Opus (opus-recorder, WASM) — mesmo formato usado no
  // WhatsApp; ainda não confirmado empiricamente se a Send API do Instagram
  // aceita, mas é o único formato viável gravável no navegador.
  async function handleMicClick() {
    if (recording) return
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
    rec.ondataavailable = () => {}
    rec.stop()
    opusRecorderRef.current = null
    setRecording(false)
    setRecordingPaused(false)
  }

  function handleSendRecording() {
    const rec = opusRecorderRef.current
    if (!rec) return
    rec.stop()
    opusRecorderRef.current = null
    setRecording(false)
    setRecordingPaused(false)
  }

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

  async function handleToggleFlag(
    action: (orgSlug: string, id: string, value: boolean) => Promise<{ ok: boolean; error?: string }>,
    field: 'archived' | 'muted' | 'pinned' | 'favorite',
    nextValue: boolean,
    successMsg: string,
  ) {
    if (!selectedConversation) return
    const res = await action(orgSlug, selectedConversation.id, nextValue)
    if (!res.ok) { toast.error(res.error || 'Não foi possível concluir a ação.'); return }
    setConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, [field]: nextValue } : c))
    toast.success(successMsg)
    router.refresh()
  }

  async function handleMarkUnread() {
    if (!selectedConversation) return
    const res = await markSocialConversationAsUnread(orgSlug, selectedConversation.id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Marcada como não lida.')
    router.push(`/app/${orgSlug}/social/inbox`)
  }

  async function handleConfirmedAction() {
    if (!selectedConversation || !confirmAction) return
    setActionLoading(true)
    try {
      if (confirmAction === 'clear') {
        const res = await clearSocialConversationMessages(orgSlug, selectedConversation.id)
        if (!res.ok) throw new Error(res.error)
        setMessages([])
        toast.success('Conversa limpa.')
      } else if (confirmAction === 'delete') {
        const res = await deleteSocialConversation(orgSlug, selectedConversation.id)
        if (!res.ok) throw new Error(res.error)
        toast.success('Conversa apagada.')
        router.push(`/app/${orgSlug}/social/inbox`)
      } else if (confirmAction === 'block') {
        const willBlock = !selectedConversation.blocked
        const res = await setSocialConversationBlocked(orgSlug, selectedConversation.id, willBlock)
        if (!res.ok) throw new Error(res.error)
        setConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, blocked: willBlock } : c))
        toast.success(willBlock ? 'Contato bloqueado.' : 'Contato desbloqueado.')
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível concluir a ação.')
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  async function handleTogglePause(paused: boolean) {
    if (!selectedConversation) return
    setPausing(true)
    const res = await toggleAutomationPause(orgSlug, selectedConversation.id, paused)
    if (!res.ok) toast.error('Não foi possível alterar', { description: res.error })
    else router.refresh()
    setPausing(false)
  }

  return (
    <div className="flex w-full h-full border-t border-[#efefef] dark:border-[#262626]">
      <div className={`w-full md:w-1/3 md:max-w-[350px] border-r border-[#efefef] dark:border-[#262626] flex-col bg-white dark:bg-black ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-3 py-2 border-b border-[#efefef] dark:border-[#262626] shrink-0">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar"
            className="h-9 text-sm rounded-xl bg-[#efefef] dark:bg-[#262626] border-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(c => (
            <div
              key={c.id}
              onClick={() => router.push(`/app/${orgSlug}/social/inbox?id=${c.id}`)}
              className={`p-3 cursor-pointer hover:bg-[#fafafa] dark:hover:bg-[#121212] transition-colors flex gap-3 justify-between items-center ${selectedConversation?.id === c.id ? 'bg-[#efefef] dark:bg-[#1a1a1a]' : ''}`}
            >
              <Avatar name={c.sender_name} username={c.sender_username} avatarUrl={c.sender_avatar_url} size="lg" />
              <div className="overflow-hidden flex-1 pr-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-sm truncate">
                    {c.sender_name || (c.sender_username ? `@${c.sender_username}` : 'Instagram')}
                  </span>
                  {c.pinned && <Pin className="w-3 h-3 shrink-0 text-muted-foreground" />}
                  {c.automation_paused && (
                    <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      manual
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {c.last_message_direction === 'outbound' && c.last_message_preview && <span>Você: </span>}
                  {c.last_message_preview || '—'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="flex items-center gap-1">
                  {c.last_message_direction === 'outbound' && <ConversationTicks status={c.last_message_status} />}
                  <span className={`text-[10px] font-medium ${c.unread_count > 0 ? 'text-[#3797f0]' : 'text-muted-foreground'}`}>{formatInboxTime(c.last_message_at)}</span>
                </span>
                {c.unread_count > 0 && (
                  <Badge variant="destructive" className="h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px] shrink-0">
                    {c.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {conversations.length === 0
                ? 'Nenhuma conversa ainda. As DMs do Instagram aparecem aqui automaticamente.'
                : 'Nenhuma conversa corresponde à busca.'}
            </div>
          )}
        </div>
      </div>

      <div
        className={`relative flex-1 flex-col bg-white dark:bg-black ${selectedConversation ? 'flex' : 'hidden md:flex'}`}
        onDragOver={e => { if (selectedConversation) { e.preventDefault(); setDraggingFile(true) } }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDraggingFile(false) }}
        onDrop={e => {
          e.preventDefault()
          setDraggingFile(false)
          if (!selectedConversation) return
          const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'))
          if (files.length === 0) { toast.error('Solte um arquivo de imagem (JPG, PNG ou WEBP).'); return }
          queueImages(files)
        }}
      >
        {selectedConversation && draggingFile && (
          <div className="absolute inset-0 z-30 bg-[#3797f0]/10 border-4 border-dashed border-[#3797f0] flex items-center justify-center pointer-events-none">
            <div className="bg-background rounded-lg px-6 py-4 shadow-lg text-sm font-medium">Solte a imagem para enviar</div>
          </div>
        )}
        {selectedConversation ? (
          <>
            <div className="px-4 md:px-6 py-3 border-b border-[#efefef] dark:border-[#262626] bg-white dark:bg-black flex justify-between items-center gap-2 h-[72px] shrink-0 z-10">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => router.push(`/app/${orgSlug}/social/inbox`)}
                  className="md:hidden shrink-0 -ml-1 p-1 rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="Voltar para a lista"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <Avatar name={selectedConversation.sender_name} username={selectedConversation.sender_username} avatarUrl={selectedConversation.sender_avatar_url} />
                <div className="min-w-0">
                  <span className="font-semibold text-sm truncate block">
                    {selectedConversation.sender_name || (selectedConversation.sender_username ? `@${selectedConversation.sender_username}` : 'Instagram')}
                  </span>
                  {selectedConversation.sender_username && selectedConversation.sender_name && (
                    <span className="text-xs text-[#8e8e8e] truncate block">@{selectedConversation.sender_username}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {selectedConversation.automation_paused ? 'Atendimento manual' : 'Automação ativa'}
                </span>
                <Switch
                  checked={!selectedConversation.automation_paused}
                  onCheckedChange={v => handleTogglePause(!v)}
                  disabled={pausing}
                  title={selectedConversation.automation_paused ? 'Devolver para o bot' : 'Pausar automação'}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
                      title="Mais opções"
                      aria-label="Mais opções"
                    >
                      <MoreVertical className="w-[18px] h-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationArchived, 'archived', !selectedConversation.archived, selectedConversation.archived ? 'Conversa desarquivada.' : 'Conversa arquivada.')}>
                      <Archive className="w-4 h-4 mr-2" /> {selectedConversation.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationMuted, 'muted', !selectedConversation.muted, selectedConversation.muted ? 'Notificações reativadas.' : 'Notificações silenciadas.')}>
                      {selectedConversation.muted ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                      {selectedConversation.muted ? 'Reativar notificações' : 'Silenciar notificações'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationPinned, 'pinned', !selectedConversation.pinned, selectedConversation.pinned ? 'Conversa desafixada.' : 'Conversa fixada.')}>
                      {selectedConversation.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                      {selectedConversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleMarkUnread}>
                      <MailQuestion className="w-4 h-4 mr-2" /> Marcar como não lida
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleFlag(setSocialConversationFavorite, 'favorite', !selectedConversation.favorite, selectedConversation.favorite ? 'Removida dos favoritos.' : 'Adicionada aos favoritos.')}>
                      <Star className="w-4 h-4 mr-2" /> {selectedConversation.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmAction('block')} className={selectedConversation.blocked ? '' : 'text-destructive focus:text-destructive'}>
                      <Ban className="w-4 h-4 mr-2" /> {selectedConversation.blocked ? 'Desbloquear contato' : 'Bloquear'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmAction('clear')} className="text-destructive focus:text-destructive">
                      <Eraser className="w-4 h-4 mr-2" /> Limpar conversa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmAction('delete')} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> Apagar conversa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map(m => {
                const isInbound = m.direction === 'inbound'
                const media = renderInstagramMedia(m, setLightboxUrl)
                return (
                  <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[65%] rounded-[22px] px-4 py-2 ${isInbound ? 'bg-[#efefef] dark:bg-[#262626] text-black dark:text-white' : 'bg-[#3797f0] text-white'}`}>
                      {media}
                      {m.message_text && <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.message_text}</div>}
                      {m.buttons && m.buttons.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2">
                          {m.buttons.map((b, k) => (
                            b.type === 'link' ? (
                              <a key={k} href={b.value} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-center px-3 py-1.5 rounded-full border border-white/40 hover:bg-white/10 truncate">
                                {b.label}
                              </a>
                            ) : (
                              <span key={k}
                                className="text-xs text-center px-3 py-1.5 rounded-full border border-white/40 truncate">
                                {b.label}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                      <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isInbound ? 'text-[#8e8e8e]' : 'text-white/70'}`}>
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {!isInbound && m.sent_by === 'agent' && m.sent_by_name && ` · ${m.sent_by_name}`}
                        {!isInbound && m.sent_by !== 'agent' && ` · ${m.sent_by === 'funnel' ? 'funil' : 'automação'}`}
                        {!isInbound && <ConversationTicks status={m.status} />}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            <form onSubmit={handleSend} className="p-4 bg-white dark:bg-black border-t border-[#efefef] dark:border-[#262626] flex gap-2 items-center shrink-0 relative">
              {recording ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-destructive shrink-0"
                    title="Descartar gravação"
                    aria-label="Descartar gravação"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  <div className="flex-1 flex items-center gap-2 min-w-0 bg-[#efefef] dark:bg-[#262626] rounded-full px-4 min-h-[44px]">
                    {!recordingPaused && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                    <span className="tabular-nums text-sm font-medium text-red-500 shrink-0">
                      {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                    </span>
                    <div className="flex-1 flex items-center gap-[3px] overflow-hidden">
                      {WAVEFORM_BARS.map((h, i) => (
                        <span
                          key={i}
                          className={`w-[3px] rounded-full shrink-0 ${recordingPaused ? 'bg-muted-foreground/30' : 'bg-[#3797f0]/50'}`}
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRecordingPauseToggle}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground shrink-0"
                    title={recordingPaused ? 'Continuar' : 'Pausar'}
                    aria-label={recordingPaused ? 'Continuar gravação' : 'Pausar gravação'}
                  >
                    {recordingPaused ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendRecording}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[#3797f0] text-white hover:opacity-90 shrink-0"
                    title="Enviar áudio"
                    aria-label="Enviar áudio"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </>
              ) : (
              <>
              {/* Emojis */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmoji(v => !v)}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground ${showEmoji ? 'bg-muted text-[#3797f0]' : ''}`}
                  title="Emojis"
                  aria-label="Emojis"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                {showEmoji && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                    <div className="absolute bottom-12 left-0 z-20 w-64 max-h-56 overflow-y-auto bg-white dark:bg-black border border-[#dbdbdb] dark:border-[#262626] rounded-2xl shadow-lg p-2 grid grid-cols-8 gap-0.5">
                      {EMOJIS.map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => { setInput(prev => prev + e); setShowEmoji(false) }}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-lg leading-none"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Imagem / anexo */}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleImageSelected} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground shrink-0 disabled:opacity-50"
                title="Inserir imagem"
                aria-label="Inserir imagem"
              >
                {uploadingMedia ? (
                  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" /></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                )}
              </button>

              <Input
                ref={inputRef}
                className="flex-1 bg-white dark:bg-black border border-[#dbdbdb] dark:border-[#262626] rounded-full px-5 min-h-[44px] focus-visible:ring-0"
                placeholder="Mensagem..."
                value={input}
                onChange={e => setInput(e.target.value)}
              />

              {input.trim() ? (
                <Button type="submit" disabled={sending} variant="ghost" className="rounded-full min-h-[44px] min-w-[44px] px-0 text-[#3797f0] hover:bg-[#efefef] dark:hover:bg-[#262626]" title="Enviar">
                  {sending ? '...' : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                  )}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={uploadingMedia}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[#3797f0] text-white hover:opacity-90 shrink-0 disabled:opacity-50"
                  title="Gravar áudio"
                  aria-label="Gravar áudio"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
              )}
              </>
              )}
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-black">
            <div className="text-center p-8 max-w-sm">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-black dark:border-white flex items-center justify-center">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2Z"/></svg>
              </div>
              <h3 className="font-normal text-xl mb-1">Suas mensagens</h3>
              <p className="text-[#8e8e8e] text-sm">Selecione uma conversa para atender manualmente.</p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={o => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'clear' && 'Limpar conversa?'}
              {confirmAction === 'delete' && 'Apagar conversa?'}
              {confirmAction === 'block' && (selectedConversation?.blocked ? 'Desbloquear contato?' : 'Bloquear contato?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'clear' && 'Apaga todas as mensagens desta conversa, mas mantém o contato na lista. Essa ação não pode ser desfeita.'}
              {confirmAction === 'delete' && 'Apaga a conversa e todas as mensagens permanentemente. Essa ação não pode ser desfeita.'}
              {confirmAction === 'block' && (selectedConversation?.blocked
                ? 'O CRM volta a permitir o envio de mensagens manuais e automáticas pra esse contato.'
                : 'O Instagram não oferece um bloqueio real pela API — isso só impede o CRM de enviar mensagens (manuais e automáticas) pra esse contato. Pra bloquear de verdade, use o app do Instagram.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction !== 'block' || !selectedConversation?.blocked ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={handleConfirmedAction}
              disabled={actionLoading}
            >
              {actionLoading ? 'Aguarde...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revisão de imagem(ns) antes de enviar — igual ao WhatsApp normal. */}
      <Dialog open={pendingImages.length > 0} onOpenChange={o => !o && closeImageComposer()}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-black text-white border-none overflow-hidden">
          {editingImage && pendingImages[composerIndex] ? (
            <div className="h-[70vh]">
              <ImageEditor
                file={pendingImages[composerIndex].file}
                onCancel={() => setEditingImage(false)}
                onApply={handleApplyEditedImage}
              />
            </div>
          ) : (
          <>
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={closeImageComposer} className="text-white/80 hover:text-white" aria-label="Cancelar">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70">{pendingImages.length > 1 ? `${composerIndex + 1} de ${pendingImages.length}` : ''}</span>
              {pendingImages[composerIndex] && (
                <button type="button" onClick={() => setEditingImage(true)} className="text-white/80 hover:text-white" aria-label="Editar imagem" title="Editar imagem">
                  <Pencil className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>
          </div>

          {pendingImages[composerIndex] && (
            <div className="flex items-center justify-center bg-black/40 min-h-[320px] max-h-[55vh] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImages[composerIndex].previewUrl} alt="" className="max-h-full max-w-full object-contain rounded" />
            </div>
          )}

          {pendingImages.length > 1 && (
            <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-black/60">
              {pendingImages.map((p, i) => (
                <div key={i} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setComposerIndex(i)}
                    className={`w-12 h-12 rounded-md overflow-hidden border-2 ${i === composerIndex ? 'border-[#3797f0]' : 'border-transparent opacity-70'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePendingImage(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center"
                    aria-label="Remover imagem"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => composerFileInputRef.current?.click()}
                className="w-12 h-12 rounded-md border-2 border-dashed border-white/30 flex items-center justify-center text-white/60 hover:text-white shrink-0"
                aria-label="Adicionar mais imagens"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}

          <input ref={composerFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleComposerAddMore} />

          <div className="flex items-center gap-2 px-4 py-3 bg-black/60">
            <Textarea
              value={pendingImages[composerIndex]?.caption || ''}
              onChange={e => {
                const v = e.target.value
                setPendingImages(prev => prev.map((p, i) => i === composerIndex ? { ...p, caption: v } : p))
              }}
              placeholder="Adicionar legenda..."
              rows={1}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none min-h-[40px]"
            />
            {pendingImages.length === 1 && (
              <button
                type="button"
                onClick={() => composerFileInputRef.current?.click()}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 shrink-0"
                title="Adicionar mais imagens"
                aria-label="Adicionar mais imagens"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSendImageQueue}
              disabled={sendingQueue}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[#3797f0] text-white hover:opacity-90 shrink-0 disabled:opacity-50"
              title="Enviar"
              aria-label="Enviar"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ampliar imagem recebida/enviada — popup em vez de nova aba. */}
      <Dialog open={!!lightboxUrl} onOpenChange={o => !o && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/95 border-none">
          {lightboxUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightboxUrl} alt="" className="w-full max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
