'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  sendWhatsappMessage, markConversationAsRead, seedMockConversations, simulateInboundMessage, cancelScheduledMessage,
  setConversationArchived, setConversationMuted, setConversationPinned, setConversationFavorite,
  markConversationAsUnread, clearConversationMessages, deleteConversation, blockWhatsappContact,
  sendWhatsappMedia, setConversationAutomationPaused,
} from '@/actions/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import ConversationDetailPanel, { agentColor, memberInitials, memberShortLabel } from '@/components/features/ConversationDetailPanel'
import ScheduleMessageButton from '@/components/features/ScheduleMessageButton'
import ImageEditor from '@/components/features/ImageEditor'
import { LinkPreviewCard, linkifyText } from '@/components/features/LinkPreviewCard'
import { extractFirstUrl } from '@/lib/link-preview/extract-url'
import { getObjectSignedUrl } from '@/actions/storage'
import { Download } from 'lucide-react'
import { Clock, X, FileText, MoreVertical, Archive, BellOff, Bell, Pin, PinOff, Star, MailQuestion, Eraser, Trash2, Ban, Plus, Send, Pencil, UserRound, Sparkles } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { assignLead, moveLeadToStage } from '@/actions/contatos'

export default function WhatsappChat({ orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages, members = [], panelContext, scheduled = [], templates = [], isMock, pipelineStages = [], aiEnabledGlobally = false }: any) {
  // Lista ao vivo — semeada pelo server, depois atualizada em tempo real
  // (ver efeito abaixo) pra não precisar de F5 quando chega mensagem nova.
  const [conversations, setConversations] = useState(conversationsProp)
  useEffect(() => { setConversations(conversationsProp) }, [conversationsProp])
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [simulating, setSimulating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [showEmoji, setShowEmoji] = useState(false)
  // Envio de imagem / gravação de áudio
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerFileInputRef = useRef<HTMLInputElement>(null)
  const opusRecorderRef = useRef<any>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  // Fila de imagens em revisão antes de enviar (colar/arrastar/selecionar
  // abre essa janela em vez de mandar direto, igual o WhatsApp normal).
  const [pendingImages, setPendingImages] = useState<{ file: File; caption: string; previewUrl: string }[]>([])
  const [composerIndex, setComposerIndex] = useState(0)
  const [sendingQueue, setSendingQueue] = useState(false)
  const [editingImage, setEditingImage] = useState(false)
  // Ampliar imagem da conversa em popup, não em nova aba.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  // Busca + filtros do inbox
  const [query, setQuery] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  // Busca de palavras dentro da conversa aberta
  const [msgQuery, setMsgQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  // Menu de opções da conversa (arquivar, silenciar, fixar, bloquear etc.)
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | 'block' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [pausingAi, setPausingAi] = useState(false)

  // Tick compartilhado pra recalcular a contagem regressiva da janela de
  // 24h grátis (API oficial) sem um setInterval por linha da lista.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const router = useRouter()

  // "Visto por último": derivado da última mensagem recebida do contato.
  // Em modo mock não há presença real, então usamos o último inbound como proxy.
  const lastSeen = useMemo(() => {
    const inbound = [...messages].reverse().find((m: any) => m.direction === 'inbound')
    if (!inbound) return null
    const d = new Date(inbound.created_at)
    const today = new Date()
    const sameDay = d.toDateString() === today.toDateString()
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return sameDay ? `visto por último hoje às ${time}` : `visto por último ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`
  }, [messages])

  // Etapa do funil do lead vinculado (para a tag compacta no cabeçalho).
  const stageName: string | null = panelContext?.lead?.pipeline_stages?.name ?? null

  // Troca rápida de etapa/responsável direto na lista de conversas, sem
  // precisar abrir a conversa. contatoId é o lead vinculado à conversa.
  async function handleQuickStageChange(contatoId: string, currentStageId: string | null, newStageId: string) {
    if (!contatoId || newStageId === currentStageId) return
    const res = await moveLeadToStage(orgSlug, contatoId, newStageId, currentStageId || '')
    if ((res as any)?.ok === false) toast.error('Não foi possível mover de etapa', { description: (res as any).error })
    else { toast.success('Etapa atualizada'); router.refresh() }
  }

  async function handleQuickAssign(contatoId: string, userId: string | null) {
    if (!contatoId) return
    const res = await assignLead(orgSlug, contatoId, userId)
    if ((res as any)?.ok === false) toast.error('Não foi possível atribuir', { description: (res as any).error })
    else { toast.success('Responsável atualizado'); router.refresh() }
  }

  const memberById = useMemo(() => {
    const map: Record<string, any> = {}
    for (const m of members) map[m.user_id] = m
    return map
  }, [members])

  // Estágios disponíveis (derivados das conversas atuais).
  const stageOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of conversations) {
      const n = c.contatos?.pipeline_stages?.name
      if (n) set.add(n)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [conversations])

  // Vendedores que aparecem como responsáveis em alguma conversa.
  const sellerOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const c of conversations) {
      const owner = c.contatos?.assigned_to
      if (owner) ids.add(owner)
    }
    return Array.from(ids).map(id => ({ id, member: memberById[id] }))
  }, [conversations, memberById])

  const activeFilters = (filterSeller ? 1 : 0) + (filterStage ? 1 : 0)

  // Inbox filtrado por busca de texto + vendedor + estágio.
  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter((c: any) => {
        // Arquivadas somem da lista principal — exceto a que está aberta
        // agora, senão ela desaparece debaixo do usuário ao arquivar.
        if (c.archived && c.id !== selectedConversation?.id) return false
        if (q) {
          const hay = `${c.contact_name || ''} ${c.contact_phone || ''} ${c.last_message_preview || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        if (filterSeller) {
          const owner = c.contatos?.assigned_to ?? null
          if (filterSeller === '__none' ? !!owner : owner !== filterSeller) return false
        }
        if (filterStage) {
          if ((c.contatos?.pipeline_stages?.name || '') !== filterStage) return false
        }
        return true
      })
      .sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  }, [conversations, query, filterSeller, filterStage, selectedConversation])

  // Mensagens visíveis: filtradas pela busca dentro da conversa.
  const visibleMessages = useMemo(() => {
    const q = msgQuery.trim().toLowerCase()
    if (!q) return messages
    return messages.filter((m: any) => msgBody(m).toLowerCase().includes(q))
  }, [messages, msgQuery])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Stable client across renders so the realtime effect below doesn't re-subscribe on every render
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setMessages(initialMessages)
    setMsgQuery('')
    setShowSearch(false)
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markConversationAsRead(orgSlug, selectedConversation.id)
    }
  }, [initialMessages, selectedConversation, orgSlug])

  // Rola pro fim (últimas mensagens) sempre que abre uma conversa — precisa
  // ser um efeito separado do de cima, disparado por `messages` (o estado
  // já renderizado), não por `initialMessages`: chamar scrollIntoView no
  // mesmo efeito que ainda vai setar o estado rola com base no layout
  // ANTERIOR (a lista antiga, ou vazia na primeira conversa aberta), o que
  // deixava a conversa abrindo no topo/mensagens antigas.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, selectedConversation?.id])

  useEffect(() => {
    const conversationId = selectedConversation?.id
    if (!conversationId) return
    const channel = supabase.channel(`chat_${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev:any) => [...prev, payload.new])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        markConversationAsRead(orgSlug, conversationId)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev:any) => prev.map((m:any) => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedConversation?.id, orgSlug, supabase])

  // Lista de conversas ao vivo: qualquer mensagem (de qualquer conversa,
  // aberta ou não) toca whatsapp_conversations.last_message_at/preview/
  // unread_count no servidor — escutando essa tabela a lista reordena e
  // mostra o não-lido sem F5. Conversa nova (contato nunca visto) não tem
  // como montar a linha completa (falta o join com contatos) só com o
  // payload do realtime, então nesse caso só pedimos um refresh silencioso.
  useEffect(() => {
    if (!orgId) return
    const channel = supabase.channel(`wa_conv_list_${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations', filter: `organization_id=eq.${orgId}` }, (payload) => {
        setConversations((prev: any[]) => {
          const idx = prev.findIndex(c => c.id === payload.new.id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...payload.new }
          next.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
          return next
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations', filter: `organization_id=eq.${orgId}` }, () => {
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

    const res = await sendWhatsappMessage(orgSlug, selectedConversation.id, text)
    if (!res.ok) {
      toast.error('Não foi possível enviar a mensagem', { description: res.error })
      setInput(text) // restore so the user doesn't lose what they typed
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // Enter envia; Shift+Enter quebra linha (igual WhatsApp normal).
  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  // A caixa de texto cresce junto com o conteúdo (até um teto), em vez de
  // rolar por dentro de uma linha só.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

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

  async function handleToggleFlag(
    action: (orgSlug: string, id: string, value: boolean) => Promise<{ ok: boolean; error?: string }>,
    field: 'archived' | 'muted' | 'pinned' | 'favorite',
    nextValue: boolean,
    successMsg: string,
  ) {
    if (!selectedConversation) return
    const res = await action(orgSlug, selectedConversation.id, nextValue)
    if (!res.ok) { toast.error(res.error || 'Não foi possível concluir a ação.'); return }
    setConversations((prev: any[]) => prev.map(c => c.id === selectedConversation.id ? { ...c, [field]: nextValue } : c))
    toast.success(successMsg)
    router.refresh()
  }

  async function handleToggleAi(nextEnabled: boolean) {
    if (!selectedConversation) return
    setPausingAi(true)
    const res = await setConversationAutomationPaused(orgSlug, selectedConversation.id, !nextEnabled)
    setPausingAi(false)
    if (!res.ok) { toast.error(res.error || 'Não foi possível alterar.'); return }
    setConversations((prev: any[]) => prev.map(c => c.id === selectedConversation.id ? { ...c, automation_paused: !nextEnabled } : c))
    toast.success(nextEnabled ? 'IA reativada nesta conversa.' : 'IA pausada — você está no controle.')
    router.refresh()
  }

  async function handleMarkUnread() {
    if (!selectedConversation) return
    const res = await markConversationAsUnread(orgSlug, selectedConversation.id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Marcada como não lida.')
    router.push(`/app/${orgSlug}/conversas`)
  }

  async function handleConfirmedAction() {
    if (!selectedConversation || !confirmAction) return
    setActionLoading(true)
    try {
      if (confirmAction === 'clear') {
        const res = await clearConversationMessages(orgSlug, selectedConversation.id)
        if (!res.ok) throw new Error(res.error)
        setMessages([])
        toast.success('Conversa limpa.')
      } else if (confirmAction === 'delete') {
        const res = await deleteConversation(orgSlug, selectedConversation.id)
        if (!res.ok) throw new Error(res.error)
        toast.success('Conversa apagada.')
        router.push(`/app/${orgSlug}/conversas`)
      } else if (confirmAction === 'block') {
        const willBlock = !selectedConversation.blocked
        const res = await blockWhatsappContact(orgSlug, selectedConversation.id, willBlock)
        if (!res.ok) throw new Error(res.error)
        setConversations((prev: any[]) => prev.map(c => c.id === selectedConversation.id ? { ...c, blocked: willBlock } : c))
        toast.success(willBlock ? 'Número bloqueado.' : 'Número desbloqueado.')
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível concluir a ação.')
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  async function handleCancelScheduled(id: string) {
    const res = await cancelScheduledMessage(orgSlug, id)
    if (!res.ok) {
      toast.error('Não foi possível cancelar', { description: res.error })
      return
    }
    toast.success('Agendamento cancelado.')
    router.refresh()
  }

  async function handleSeed() {
    setSeeding(true)
    const res = await seedMockConversations(orgSlug)
    if (res.ok) {
      toast.success(`${res.created} conversas de teste criadas.`)
      router.refresh()
    } else {
      toast.error('Não foi possível gerar as conversas', { description: res.error })
    }
    setSeeding(false)
  }

  async function handleSimulateInbound() {
    if (!selectedConversation) return
    setSimulating(true)
    const text = input.trim() || 'Mensagem de teste do cliente 👋'
    if (input.trim()) setInput('')
    const res = await simulateInboundMessage(orgSlug, selectedConversation.id, text)
    if (!res.ok) {
      toast.error('Não foi possível simular a resposta', { description: res.error })
    }
    setSimulating(false)
  }

  return (
    <div className="flex w-full h-full border-t">
      <div className={`w-full md:w-1/3 md:max-w-[350px] border-r border-[#e9edef] dark:border-[#2a3942] flex-col bg-white dark:bg-[#111b21] ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        {/* Busca + filtros do inbox */}
        <div className="px-3 pt-3 pb-2 border-b bg-background shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Pesquisar conversas..."
                className="h-9 pl-8 pr-7 text-sm rounded-full bg-muted/50"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`relative h-9 w-9 shrink-0 flex items-center justify-center rounded-full border hover:bg-muted ${showFilters || activeFilters ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}`}
              title="Filtros"
              aria-label="Filtros"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              {activeFilters > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeFilters}</span>
              )}
            </button>
            <Link
              href={`/app/${orgSlug}/whatsapp-templates`}
              className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Templates de mensagem do WhatsApp"
              aria-label="Templates de mensagem do WhatsApp"
            >
              <FileText className="w-4 h-4" />
            </Link>
            {isMock && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSeed}
                disabled={seeding}
                className="text-xs h-9 shrink-0"
                title="Modo de teste — gera conversas fictícias (WhatsApp não conectado)"
              >
                {seeding ? '...' : '🧪'}
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <select
                value={filterSeller}
                onChange={e => setFilterSeller(e.target.value)}
                className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
                aria-label="Filtrar por vendedor"
              >
                <option value="">Todos os vendedores</option>
                <option value="__none">Sem responsável</option>
                {sellerOptions.map(({ id, member }) => (
                  <option key={id} value={id}>{member?.name || member?.email || 'Membro'}</option>
                ))}
              </select>
              <select
                value={filterStage}
                onChange={e => setFilterStage(e.target.value)}
                className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
                aria-label="Filtrar por estágio"
              >
                <option value="">Todos os estágios</option>
                {stageOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => { setFilterSeller(''); setFilterStage('') }}
                  className="col-span-2 text-[11px] text-muted-foreground hover:text-foreground text-left"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((c: any) => (
            <div key={c.id} onClick={() => router.push(`/app/${orgSlug}/conversas?id=${c.id}`)} className={`p-3 border-b border-[#e9edef] dark:border-[#2a3942] cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors flex justify-between items-start gap-3 ${selectedConversation?.id === c.id ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : ''}`}>
              {c.contatos?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.contatos.avatar_url} alt="" className="h-9 w-9 rounded-full shrink-0 object-cover" />
              ) : (
                <div className={`h-9 w-9 rounded-full shrink-0 ${agentColor(c.contact_phone || c.id)} text-white text-[11px] font-semibold flex items-center justify-center`}>
                  {memberInitials(c.contact_name, c.contact_phone)}
                </div>
              )}
              <div className="overflow-hidden flex-1 pr-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-sm truncate block min-w-0">{c.contact_name || c.contact_phone}</span>
                  {aiEnabledGlobally && c.automation_paused && (
                    <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200" title="Atendimento manual — IA pausada nesta conversa">
                      manual
                    </span>
                  )}
                  {c.ai_handoff_summary && (
                    <Sparkles className="w-3 h-3 text-primary shrink-0" aria-label="Tem resumo da IA" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                  <span className="truncate">{c.last_message_preview || c.contact_phone}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="flex items-center gap-1">
                  {c.last_message_direction === 'outbound' && <ConversationTicks status={c.last_message_status} />}
                  <span className={`text-[10px] font-medium ${c.unread_count > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{formatInboxTime(c.last_message_at)}</span>
                </span>

                {/* Janela de 24h isolada — vendedor + etapa saem daqui e viram
                    a linha de baixo, lado a lado, pra ficar fácil de bater o
                    olho em quem é responsável e onde o lead está no funil. */}
                <div className="flex items-center gap-1">
                  <WindowBadge lastInboundAt={c.last_inbound_at} now={now} />
                </div>

                <div className="flex items-center gap-1.5">
                  {c.unread_count > 0 && <Badge variant="destructive" className="h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px]">{c.unread_count}</Badge>}
                  {c.contatos?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={e => e.stopPropagation()}
                          className={`h-5 w-[76px] shrink-0 rounded-pill ${agentColor(c.contatos?.assigned_to ?? null)} text-white text-[9px] font-semibold flex items-center justify-center px-1.5 truncate hover:ring-2 hover:ring-offset-1 hover:ring-primary/40 transition-all`}
                          title={(() => {
                            const m = memberById[c.contatos?.assigned_to]
                            return m ? `Responsável: ${m.name || m.email} — clique para mudar` : 'Sem responsável — clique para atribuir'
                          })()}
                        >
                          <span className="truncate">
                            {c.contatos?.assigned_to
                              ? memberShortLabel(memberById[c.contatos.assigned_to]?.name, memberById[c.contatos.assigned_to]?.email)
                              : 'Sem resp.'}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleQuickAssign(c.contatos.id, null)}>Ninguém</DropdownMenuItem>
                        {members.map((m: any) => (
                          <DropdownMenuItem key={m.user_id} onClick={() => handleQuickAssign(c.contatos.id, m.user_id)}>
                            {m.name || m.email}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {c.contatos?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {(() => {
                          const stageColor = c.contatos?.pipeline_stages?.color || '#8a3ffc'
                          return (
                            <button
                              type="button"
                              onClick={e => e.stopPropagation()}
                              className="shrink-0 inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-pill border max-w-[90px] transition-colors"
                              style={{ backgroundColor: `${stageColor}26`, color: stageColor, borderColor: `${stageColor}40` }}
                              title={c.contatos?.pipeline_stages?.name ? `Etapa: ${c.contatos.pipeline_stages.name} — clique para mudar` : 'Definir etapa'}
                            >
                              <span className="h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
                              <span className="truncate">{c.contatos?.pipeline_stages?.name || 'Sem etapa'}</span>
                            </button>
                          )
                        })()}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        {pipelineStages
                          .filter((s: any) => !c.contatos?.pipeline_id || s.pipeline_id === c.contatos.pipeline_id)
                          .map((s: any) => (
                            <DropdownMenuItem key={s.id} onClick={() => handleQuickStageChange(c.contatos.id, c.contatos?.stage_id ?? null, s.id)}>
                              {s.name}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {conversations.length === 0
                ? 'Nenhuma conversa encontrada.'
                : 'Nenhuma conversa corresponde à busca ou aos filtros.'}
            </div>
          )}
        </div>
      </div>

      <div
        className={`relative flex-1 min-w-0 flex-col overflow-x-hidden bg-[#efeae2] dark:bg-[#0b141a] ${selectedConversation ? 'flex' : 'hidden md:flex'}`}
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
          <div className="absolute inset-0 z-30 bg-primary/10 border-4 border-dashed border-primary flex items-center justify-center pointer-events-none">
            <div className="bg-background rounded-lg px-6 py-4 shadow-lg text-sm font-medium">Solte a imagem para enviar</div>
          </div>
        )}
        {selectedConversation ? (
          <>
            <div className="px-4 md:px-6 py-3 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] flex justify-between items-center gap-2 h-16 shrink-0 overflow-hidden z-10">
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => router.push(`/app/${orgSlug}/conversas`)}
                  className="md:hidden shrink-0 -ml-1 p-1 rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="Voltar para a lista"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm truncate block min-w-0 max-w-[140px] sm:max-w-[260px]">{selectedConversation.contact_name || selectedConversation.contact_phone}</span>
                    {stageName && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {stageName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{lastSeen || selectedConversation.contact_phone}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {aiEnabledGlobally && (
                  <span className="hidden sm:flex items-center gap-1.5 mr-1" title={selectedConversation.automation_paused ? 'IA pausada nesta conversa — você está no controle.' : 'IA ativa nesta conversa.'}>
                    <span className="text-[11px] text-muted-foreground">{selectedConversation.automation_paused ? 'IA pausada' : 'IA ativa'}</span>
                    <Switch
                      checked={!selectedConversation.automation_paused}
                      onCheckedChange={handleToggleAi}
                      disabled={pausingAi}
                    />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowSearch(v => { if (v) setMsgQuery(''); return !v })}
                  className={`h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted ${showSearch ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                  title="Pesquisar nesta conversa"
                  aria-label="Pesquisar nesta conversa"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </button>
                {selectedConversation.contato_id && (
                  <Link
                    href={`/app/${orgSlug}/contatos/${selectedConversation.contato_id}`}
                    title="Abrir contato"
                    aria-label="Abrir contato"
                    className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                  >
                    <UserRound className="w-[18px] h-[18px]" />
                  </Link>
                )}
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
                    <DropdownMenuItem onClick={() => handleToggleFlag(setConversationArchived, 'archived', !selectedConversation.archived, selectedConversation.archived ? 'Conversa desarquivada.' : 'Conversa arquivada.')}>
                      <Archive className="w-4 h-4 mr-2" /> {selectedConversation.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleFlag(setConversationMuted, 'muted', !selectedConversation.muted, selectedConversation.muted ? 'Notificações reativadas.' : 'Notificações silenciadas.')}>
                      {selectedConversation.muted ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                      {selectedConversation.muted ? 'Reativar notificações' : 'Silenciar notificações'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleFlag(setConversationPinned, 'pinned', !selectedConversation.pinned, selectedConversation.pinned ? 'Conversa desafixada.' : 'Conversa fixada.')}>
                      {selectedConversation.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                      {selectedConversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleMarkUnread}>
                      <MailQuestion className="w-4 h-4 mr-2" /> Marcar como não lida
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleFlag(setConversationFavorite, 'favorite', !selectedConversation.favorite, selectedConversation.favorite ? 'Removida dos favoritos.' : 'Adicionada aos favoritos.')}>
                      <Star className="w-4 h-4 mr-2" /> {selectedConversation.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmAction('block')} className={selectedConversation.blocked ? '' : 'text-destructive focus:text-destructive'}>
                      <Ban className="w-4 h-4 mr-2" /> {selectedConversation.blocked ? 'Desbloquear número' : 'Bloquear'}
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

            {showSearch && (
              <div className="px-4 md:px-6 py-2 border-b bg-background flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <Input
                    autoFocus
                    value={msgQuery}
                    onChange={e => setMsgQuery(e.target.value)}
                    placeholder="Pesquisar palavras nesta conversa..."
                    className="h-9 pl-8 text-sm rounded-full bg-muted/50"
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {msgQuery.trim() ? `${visibleMessages.length} resultado${visibleMessages.length === 1 ? '' : 's'}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => { setShowSearch(false); setMsgQuery('') }}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground shrink-0"
                  aria-label="Fechar busca"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3">
              {visibleMessages.map((m: any) => {
                const isInbound = m.direction === 'inbound'
                const media = renderWhatsappMedia(m, orgSlug, setLightboxUrl)
                const text = msgBody(m)
                const linkUrl = !media && text && !msgQuery.trim() ? extractFirstUrl(text) : null
                return (
                  <div key={m.id} className={`flex min-w-0 ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[75%] min-w-0 rounded-[7px] px-2.5 py-1.5 relative shadow-sm ${
                        isInbound
                          ? 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-[2px]'
                          : 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-[2px]'
                      }`}
                    >
                      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {media || (text ? (linkUrl ? linkifyText(text) : highlightText(text, msgQuery)) : '[Mídia recebida]')}
                      </div>
                      {linkUrl && <LinkPreviewCard url={linkUrl} />}
                      <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 text-[#667781] dark:text-[#8696a0]`}>
                        {!isInbound && m.sent_by_name && <span className="truncate max-w-[120px]">{m.sent_by_name} ·</span>}
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {!isInbound && <MessageTicks status={m.status} />}
                      </div>
                    </div>
                  </div>
                )
              })}
              {msgQuery.trim() && visibleMessages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem com “{msgQuery.trim()}”.</div>
              )}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {scheduled.length > 0 && (
              <div className="px-4 pt-2 bg-background border-t shrink-0 space-y-1">
                {scheduled.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium shrink-0">
                      {new Date(s.send_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="truncate flex-1 text-amber-800">{s.body}</span>
                    <button
                      type="button"
                      onClick={() => handleCancelScheduled(s.id)}
                      className="shrink-0 hover:text-red-600"
                      title="Cancelar agendamento"
                      aria-label="Cancelar agendamento"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="px-2 py-1.5 sm:px-3 sm:py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942] flex gap-0.5 sm:gap-2 items-center shrink-0 z-10 relative">
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

                  <div className="flex-1 flex items-center gap-2 min-w-0 bg-background rounded-full px-4 min-h-[44px]">
                    {!recordingPaused && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                    <span className="tabular-nums text-sm font-medium text-red-500 shrink-0">
                      {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                    </span>
                    <div className="flex-1 flex items-center gap-[3px] overflow-hidden">
                      {WAVEFORM_BARS.map((h, i) => (
                        <span
                          key={i}
                          className={`w-[3px] rounded-full shrink-0 ${recordingPaused ? 'bg-muted-foreground/30' : 'bg-primary/50'}`}
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
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 shrink-0"
                    title="Enviar áudio"
                    aria-label="Enviar áudio"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </>
              ) : (
              <>
              {isMock && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSimulateInbound}
                  disabled={simulating}
                  className="rounded-full min-h-[44px] px-3 text-muted-foreground shrink-0"
                  title="Modo de teste — insere uma mensagem como se o cliente tivesse respondido"
                >
                  {simulating ? '...' : '🧪'}
                </Button>
              )}

              {/* Emojis */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmoji(v => !v)}
                  className={`min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground ${showEmoji ? 'bg-muted text-primary' : ''}`}
                  title="Emojis e figurinhas"
                  aria-label="Emojis e figurinhas"
                >
                  <svg className="w-[19px] h-[19px] sm:w-[22px] sm:h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                {showEmoji && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                    <div className="absolute bottom-12 left-0 z-20 w-64 max-h-56 overflow-y-auto bg-background border rounded-none   p-2 grid grid-cols-8 gap-0.5">
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground shrink-0 disabled:opacity-50"
                title="Inserir imagem"
                aria-label="Inserir imagem"
              >
                {uploadingMedia ? (
                  <svg className="animate-spin w-[18px] h-[18px] sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" /></svg>
                ) : (
                  <svg className="w-[19px] h-[19px] sm:w-[22px] sm:h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                )}
              </button>

              {/* Agendar envio */}
              <ScheduleMessageButton
                orgSlug={orgSlug}
                conversationId={selectedConversation.id}
                text={input}
                templates={templates}
                onScheduled={() => setInput('')}
              />

              <Textarea
                ref={inputRef}
                rows={1}
                className="flex-1 bg-secondary rounded-[20px] px-3.5 sm:px-5 py-2 sm:py-2.5 min-h-[38px] sm:min-h-[44px] max-h-40 resize-none leading-snug"
                placeholder="Digite uma mensagem..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
              />

              {input.trim() ? (
                <Button type="submit" disabled={sending} className="rounded-full min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] px-0 flex items-center justify-center" title="Enviar">
                  {sending ? '...' : (
                    <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  )}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={uploadingMedia}
                  className="min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 shrink-0 disabled:opacity-50"
                  title="Gravar áudio"
                  aria-label="Gravar áudio"
                >
                  <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
              )}
              </>
              )}
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white/60">
            <div className="text-center p-8 bg-background/80 rounded-none   border max-w-sm">
               <h3 className="font-semibold text-lg mb-2">WhatsApp Web</h3>
               <p className="text-muted-foreground text-sm">Selecione uma conversa na barra lateral para iniciar o atendimento ao cliente.</p>
            </div>
          </div>
        )}
      </div>

      {selectedConversation && (
        <ConversationDetailPanel
          orgSlug={orgSlug}
          conversation={selectedConversation}
          context={panelContext}
          members={members}
          open={panelOpen}
          onToggle={() => setPanelOpen(o => !o)}
        />
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={o => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'clear' && 'Limpar conversa?'}
              {confirmAction === 'delete' && 'Apagar conversa?'}
              {confirmAction === 'block' && (selectedConversation?.blocked ? 'Desbloquear número?' : 'Bloquear número?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'clear' && 'Apaga todas as mensagens desta conversa, mas mantém o contato na lista. Essa ação não pode ser desfeita.'}
              {confirmAction === 'delete' && 'Apaga a conversa e todas as mensagens permanentemente. Essa ação não pode ser desfeita.'}
              {confirmAction === 'block' && (selectedConversation?.blocked
                ? 'Esse número volta a poder enviar mensagens pro seu WhatsApp.'
                : 'Esse número deixa de conseguir enviar mensagens pro seu WhatsApp (bloqueio feito direto na API oficial da Meta).')}
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

      {/* Revisão de imagem(ns) antes de enviar — igual ao WhatsApp normal:
          abre em vez de mandar direto ao colar/arrastar/selecionar. */}
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
                    className={`w-12 h-12 rounded-md overflow-hidden border-2 ${i === composerIndex ? 'border-primary' : 'border-transparent opacity-70'}`}
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 shrink-0 disabled:opacity-50"
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

// Extrai o texto de uma mensagem (cobre os dois formatos de content).
function msgBody(m: any): string {
  return m?.content?.text?.body || m?.content?.body || ''
}

// Botão de download — só aparece quando a mensagem tem media_object_id
// (mídia migrada pro R2; mensagem antiga/legada sem essa referência não
// ganha o botão). Ao clicar, pede uma signed URL nova com
// Content-Disposition: attachment (força download mesmo pra imagem/PDF,
// que o navegador abriria inline com a URL "de visualização" normal).
function DownloadMediaButton({ orgSlug, objectId, className }: { orgSlug: string; objectId: string; className?: string }) {
  const [loading, setLoading] = useState(false)
  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const res = await getObjectSignedUrl(orgSlug, objectId, { download: true })
      if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer')
      else toast.error(res.error)
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      title="Baixar mídia"
      className={className ?? 'shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50'}
    >
      <Download className="w-4 h-4" />
    </button>
  )
}

// Renderiza a mídia de uma mensagem (o webhook baixa e salva a URL
// permanente em content.media_url — ver app/api/webhooks/whatsapp/route.ts).
// Retorna null pra mensagens de texto puro, deixando o texto normal aparecer.
function renderWhatsappMedia(m: any, orgSlug: string, onImageClick?: (url: string) => void): React.ReactNode {
  const mediaUrl: string | undefined = m?.content?.media_url
  const objectId: string | undefined = m?.content?.media_object_id
  const caption: string | undefined = m?.content?.[m.type]?.caption
  if (!mediaUrl) return null

  if (m.type === 'image') {
    return (
      <div className="space-y-1.5">
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl} alt="" className="rounded-lg max-w-full max-h-72 object-cover cursor-pointer"
            onClick={() => onImageClick?.(mediaUrl)}
          />
          {objectId && (
            <DownloadMediaButton
              orgSlug={orgSlug} objectId={objectId}
              className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>
        {caption && <div className="whitespace-pre-wrap break-words">{caption}</div>}
      </div>
    )
  }
  if (m.type === 'sticker') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl} alt="" className="w-32 h-32 object-contain" />
  }
  if (m.type === 'video') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-end gap-1.5">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls src={mediaUrl} className="rounded-lg max-w-full max-h-72" />
          {objectId && <DownloadMediaButton orgSlug={orgSlug} objectId={objectId} />}
        </div>
        {caption && <div className="whitespace-pre-wrap break-words">{caption}</div>}
      </div>
    )
  }
  if (m.type === 'audio') {
    return (
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={mediaUrl} className="w-full max-w-[220px]" />
        {objectId && <DownloadMediaButton orgSlug={orgSlug} objectId={objectId} />}
      </div>
    )
  }
  if (m.type === 'document') {
    const filename = m?.content?.document?.filename || 'Documento'
    return (
      <div className="flex items-center gap-2">
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline min-w-0">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">{filename}</span>
        </a>
        {objectId && <DownloadMediaButton orgSlug={orgSlug} objectId={objectId} />}
      </div>
    )
  }
  return <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">Abrir mídia</a>
}

// Destaca todas as ocorrências do termo de busca dentro de um texto.
function highlightText(text: string, q: string): React.ReactNode {
  const term = q.trim()
  if (!term) return text
  const lower = text.toLowerCase()
  const needle = term.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < text.length) {
    const idx = lower.indexOf(needle, i)
    if (idx === -1) { parts.push(text.slice(i)); break }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(<mark key={key++} className="bg-yellow-300/70 rounded-sm px-0.5 text-black">{text.slice(idx, idx + needle.length)}</mark>)
    i = idx + needle.length
  }
  return parts
}

// Marcadores de status estilo WhatsApp:
//  • relógio  → pendente/enviando
//  • 1 tique cinza → enviado (sent)
//  • 2 tiques cinza → entregue (delivered)
//  • 2 tiques azuis → lido (read)
//  • triângulo vermelho → falha
// Tick de confirmação ao lado do horário, na lista de conversas — mesmas
// regras do MessageTicks (relógio/1 check/2 checks/2 checks azuis), mas com
// cores pra fundo claro (a lista não tem o balão colorido de fundo).
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

function MessageTicks({ status }: { status?: string }) {
  if (status === 'failed') {
    return <span title="Falha no envio" className="text-red-500 text-[11px] leading-none">⚠</span>
  }
  if (!status || status === 'pending' || status === 'sending') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground/60" aria-label="Enviando">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" />
      </svg>
    )
  }
  const isRead = status === 'read'
  const isDouble = status === 'delivered' || status === 'read'
  const cls = isRead ? 'text-sky-200' : 'text-primary-foreground/60'
  const label = isRead ? 'Lida' : isDouble ? 'Entregue' : 'Enviada'
  return (
    <svg
      width={isDouble ? 18 : 13}
      height="11"
      viewBox={isDouble ? '0 0 18 11' : '0 0 12 11'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-label={label}
    >
      <path d="M1 5.5 4.5 9 11 1.5" />
      {isDouble && <path d="M6 5.5 9.5 9 16 1.5" />}
    </svg>
  )
}

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Contagem regressiva da janela grátis de 24h da API oficial do WhatsApp:
 * a partir da última mensagem INBOUND (do cliente), a empresa pode
 * responder de graça com mensagem livre; passado isso, só com template
 * aprovado. `lastInboundAt` vem de whatsapp_conversations.last_inbound_at
 * (setado só no webhook, nunca no envio) — se nulo, a conversa nunca
 * recebeu mensagem do cliente e não há janela a contar.
 */
function WindowBadge({ lastInboundAt, now }: { lastInboundAt?: string | null; now: number }) {
  if (!lastInboundAt) return null
  const inboundMs = new Date(lastInboundAt).getTime()
  if (isNaN(inboundMs)) return null
  const remainingMs = inboundMs + WHATSAPP_WINDOW_MS - now

  if (remainingMs <= 0) {
    return (
      <span
        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
        title="Janela de 24h encerrada — só é possível responder com um template aprovado."
      >
        Janela fechada
      </span>
    )
  }

  const hours = Math.floor(remainingMs / 3_600_000)
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)
  const label = hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes}min`
  const urgent = remainingMs < 60 * 60_000 // menos de 1h restante

  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${
        urgent
          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
          : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
      }`}
      title="Tempo restante da janela grátis de 24h pra responder sem template."
    >
      {label}
    </span>
  )
}

// Horário do inbox no estilo WhatsApp: hoje → HH:MM, ontem → "Ontem",
// últimos 7 dias → dia da semana, mais antigo → DD/MM/AAAA.
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

// Alturas fixas pra "forma de onda" decorativa da barra de gravação (não é
// reativa ao áudio de verdade — só um efeito visual leve, tipo o do WhatsApp).
const WAVEFORM_BARS = Array.from({ length: 40 }, (_, i) => 6 + Math.round(10 * Math.abs(Math.sin(i * 0.7))))

// Conjunto enxuto de emojis comuns para atendimento (sem libs externas).
const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤗','🤔','😅','😉','🙂','😇','🥳','😏',
  '👍','👎','👏','🙏','💪','🤝','👋','✌️','🤙','👌','🫶','💯','🔥','✨','⭐','🎉',
  '❤️','🧡','💛','💚','💙','💜','🤍','💔','😢','😭','😅','😡','😱','🤯','🥺','😴',
  '✅','❌','⚠️','📌','📎','📷','🎁','💰','💳','🛫','🏨','🌴','🗺️','📅','⏰','📞',
]
