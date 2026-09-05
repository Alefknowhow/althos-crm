'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  sendWhatsappMessage, markConversationAsRead, seedMockConversations, simulateInboundMessage, cancelScheduledMessage,
  setConversationArchived, setConversationMuted, setConversationPinned, setConversationFavorite,
  markConversationAsUnread, clearConversationMessages, deleteConversation, blockWhatsappContact,
  sendWhatsappMedia, setConversationAutomationPaused, suggestWhatsappReply,
} from '@/actions/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import ConversationDetailPanel from '@/components/features/ConversationDetailPanel'
import ScheduleMessageButton from '@/components/features/ScheduleMessageButton'
import { LinkPreviewCard, linkifyText } from '@/components/features/LinkPreviewCard'
import { extractFirstUrl } from '@/lib/link-preview/extract-url'
import { Clock, X, MoreVertical, Archive, BellOff, Bell, Pin, PinOff, Star, MailQuestion, Eraser, Trash2, Ban, UserRound, Sparkles, Loader2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { assignLead, moveLeadToStage } from '@/actions/contatos'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog, isNegotiationStage } from '@/components/features/pipeline/StageMoveDialogs'
import {
  msgBody, renderWhatsappMedia, highlightText, MessageTicks,
  WAVEFORM_BARS, EMOJIS,
} from './WhatsappChatWidgets'
import {
  WhatsappChatConfirmDialog, WhatsappChatImageComposerDialog, WhatsappChatLightboxDialog,
} from './WhatsappChatDialogs'
import WhatsappChatSidebar from './WhatsappChatSidebar'

export default function WhatsappChat({ orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages, members = [], panelContext, scheduled = [], templates = [], emailTemplates = [], orgName, isMock, pipelineStages = [], aiEnabledGlobally = false }: any) {
  // Lista ao vivo — semeada pelo server, depois atualizada em tempo real
  // (ver efeito abaixo) pra não precisar de F5 quando chega mensagem nova.
  const [conversations, setConversations] = useState(conversationsProp)
  useEffect(() => { setConversations(conversationsProp) }, [conversationsProp])
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [simulating, setSimulating] = useState(false)
  const [suggestingReply, setSuggestingReply] = useState(false)
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

  // Popups ao mover pra etapa is_won/is_lost/"Negociação" — mesma regra do
  // Kanban (ver components/features/pipeline/StageMoveDialogs.tsx).
  const [quickStagePrompt, setQuickStagePrompt] = useState<{
    kind: 'lost' | 'won' | 'negotiation'
    contatoId: string
    currentStageId: string | null
    newStageId: string
    defaultCents: number
  } | null>(null)

  // Troca rápida de etapa/responsável direto na lista de conversas, sem
  // precisar abrir a conversa. contatoId é o lead vinculado à conversa.
  async function commitQuickStageChange(
    contatoId: string, currentStageId: string | null, newStageId: string,
    closeInfo?: { dealStatus: 'perdido' | 'desqualificado'; reason: string },
    valueCents?: number,
  ) {
    const res = await moveLeadToStage(orgSlug, contatoId, newStageId, currentStageId || '', closeInfo, valueCents)
    if ((res as any)?.ok === false) toast.error('Não foi possível mover de etapa', { description: (res as any).error })
    else { toast.success('Etapa atualizada'); router.refresh() }
  }

  function handleQuickStageChange(contatoId: string, currentStageId: string | null, newStageId: string) {
    if (!contatoId || newStageId === currentStageId) return
    const stage = pipelineStages.find((s: any) => s.id === newStageId)
    const defaultCents = conversations.find((c: any) => c.contatos?.id === contatoId)?.contatos?.value_cents || 0
    if (stage?.is_lost) { setQuickStagePrompt({ kind: 'lost', contatoId, currentStageId, newStageId, defaultCents }); return }
    if (stage?.is_won) { setQuickStagePrompt({ kind: 'won', contatoId, currentStageId, newStageId, defaultCents }); return }
    if (isNegotiationStage(stage)) { setQuickStagePrompt({ kind: 'negotiation', contatoId, currentStageId, newStageId, defaultCents }); return }
    commitQuickStageChange(contatoId, currentStageId, newStageId)
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

  // "Sugestão de resposta" — a IA lê a conversa e só preenche a caixa de
  // texto; quem decide se envia (e pode editar antes) é o humano, igual
  // deixar um rascunho pronto. Não substitui o que já estava digitado sem
  // perguntar, pra não apagar algo que o atendente já tinha começado.
  async function handleSuggestReply() {
    if (!selectedConversation || suggestingReply) return
    if (input.trim()) {
      const overwrite = window.confirm('Já tem um texto na caixa de digitação. Substituir pela sugestão da IA?')
      if (!overwrite) return
    }
    setSuggestingReply(true)
    const res = await suggestWhatsappReply(orgSlug, selectedConversation.id)
    setSuggestingReply(false)
    if (!res.ok) {
      toast.error('Não foi possível gerar sugestão', { description: res.error })
      return
    }
    setInput(res.suggestion)
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
      <WhatsappChatSidebar
        orgSlug={orgSlug}
        isMock={isMock}
        seeding={seeding}
        handleSeed={handleSeed}
        query={query}
        setQuery={setQuery}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        activeFilters={activeFilters}
        filterSeller={filterSeller}
        setFilterSeller={setFilterSeller}
        filterStage={filterStage}
        setFilterStage={setFilterStage}
        sellerOptions={sellerOptions}
        stageOptions={stageOptions}
        filteredConversations={filteredConversations}
        conversations={conversations}
        selectedConversation={selectedConversation}
        router={router}
        aiEnabledGlobally={aiEnabledGlobally}
        members={members}
        pipelineStages={pipelineStages}
        memberById={memberById}
        handleQuickAssign={handleQuickAssign}
        handleQuickStageChange={handleQuickStageChange}
        now={now}
      />

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

              {/* Sugestão de resposta da IA — discreto de propósito: só
                  preenche a caixa, não envia nada sozinho. */}
              <button
                type="button"
                onClick={handleSuggestReply}
                disabled={suggestingReply}
                className="min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground/60 hover:text-primary disabled:opacity-50 shrink-0"
                title="Sugestão de resposta (IA)"
                aria-label="Sugestão de resposta (IA)"
              >
                {suggestingReply
                  ? <Loader2 className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] animate-spin" />
                  : <Sparkles className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px]" />}
              </button>

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
          templates={emailTemplates}
          orgName={orgName}
          open={panelOpen}
          onToggle={() => setPanelOpen(o => !o)}
        />
      )}

      <WhatsappChatConfirmDialog
        confirmAction={confirmAction}
        setConfirmAction={setConfirmAction}
        actionLoading={actionLoading}
        selectedConversation={selectedConversation}
        handleConfirmedAction={handleConfirmedAction}
      />

      {/* Revisão de imagem(ns) antes de enviar — igual ao WhatsApp normal:
          abre em vez de mandar direto ao colar/arrastar/selecionar. */}
      <WhatsappChatImageComposerDialog
        pendingImages={pendingImages}
        closeImageComposer={closeImageComposer}
        editingImage={editingImage}
        setEditingImage={setEditingImage}
        composerIndex={composerIndex}
        setComposerIndex={setComposerIndex}
        handleApplyEditedImage={handleApplyEditedImage}
        removePendingImage={removePendingImage}
        composerFileInputRef={composerFileInputRef}
        handleComposerAddMore={handleComposerAddMore}
        setPendingImages={setPendingImages}
        handleSendImageQueue={handleSendImageQueue}
        sendingQueue={sendingQueue}
      />

      {/* Ampliar imagem recebida/enviada — popup em vez de nova aba. */}
      <WhatsappChatLightboxDialog lightboxUrl={lightboxUrl} setLightboxUrl={setLightboxUrl} />

      <LostMoveDialog
        open={quickStagePrompt?.kind === 'lost'}
        onCancel={() => setQuickStagePrompt(null)}
        onConfirm={(dealStatus, reason) => {
          if (quickStagePrompt) commitQuickStageChange(quickStagePrompt.contatoId, quickStagePrompt.currentStageId, quickStagePrompt.newStageId, { dealStatus, reason })
          setQuickStagePrompt(null)
        }}
      />
      <WonValueDialog
        open={quickStagePrompt?.kind === 'won'}
        defaultCents={quickStagePrompt?.defaultCents}
        onCancel={() => setQuickStagePrompt(null)}
        onConfirm={valueCents => {
          if (quickStagePrompt) commitQuickStageChange(quickStagePrompt.contatoId, quickStagePrompt.currentStageId, quickStagePrompt.newStageId, undefined, valueCents)
          setQuickStagePrompt(null)
        }}
      />
      <NegotiationValueDialog
        open={quickStagePrompt?.kind === 'negotiation'}
        defaultCents={quickStagePrompt?.defaultCents}
        onCancel={() => setQuickStagePrompt(null)}
        onConfirm={valueCents => {
          if (quickStagePrompt) commitQuickStageChange(quickStagePrompt.contatoId, quickStagePrompt.currentStageId, quickStagePrompt.newStageId, undefined, valueCents)
          setQuickStagePrompt(null)
        }}
      />
    </div>
  )
}
