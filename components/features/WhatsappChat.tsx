'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  sendWhatsappMessage, markConversationAsRead, seedMockConversations, simulateInboundMessage, cancelScheduledMessage,
  markConversationAsUnread, clearConversationMessages, deleteConversation, blockWhatsappContact,
  sendWhatsappMedia, setConversationAutomationPaused, suggestWhatsappReply,
} from '@/actions/whatsapp'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ConversationDetailPanel from '@/components/features/ConversationDetailPanel'
import { assignLead, moveLeadToStage } from '@/actions/contatos'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog, isNegotiationStage } from '@/components/features/pipeline/StageMoveDialogs'
import { msgBody } from './WhatsappChatWidgets'
import {
  WhatsappChatConfirmDialog, WhatsappChatImageComposerDialog, WhatsappChatLightboxDialog,
} from './WhatsappChatDialogs'
import WhatsappChatSidebar from './WhatsappChatSidebar'
import WhatsappChatComposer from './WhatsappChatComposer'
import WhatsappChatHeader from './WhatsappChatHeader'
import WhatsappChatMessagesPane from './WhatsappChatMessagesPane'

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
            <WhatsappChatHeader
              orgSlug={orgSlug}
              router={router}
              selectedConversation={selectedConversation}
              stageName={stageName}
              lastSeen={lastSeen}
              aiEnabledGlobally={aiEnabledGlobally}
              pausingAi={pausingAi}
              handleToggleAi={handleToggleAi}
              showSearch={showSearch}
              setShowSearch={setShowSearch}
              setMsgQuery={setMsgQuery}
              handleToggleFlag={handleToggleFlag}
              handleMarkUnread={handleMarkUnread}
              setConfirmAction={setConfirmAction}
            />

            <WhatsappChatMessagesPane
              showSearch={showSearch}
              setShowSearch={setShowSearch}
              msgQuery={msgQuery}
              setMsgQuery={setMsgQuery}
              visibleMessages={visibleMessages}
              orgSlug={orgSlug}
              setLightboxUrl={setLightboxUrl}
              messagesEndRef={messagesEndRef}
              scheduled={scheduled}
              handleCancelScheduled={handleCancelScheduled}
            />

            <WhatsappChatComposer
              handleSend={handleSend}
              recording={recording}
              recordingPaused={recordingPaused}
              recordingSeconds={recordingSeconds}
              handleCancelRecording={handleCancelRecording}
              handleRecordingPauseToggle={handleRecordingPauseToggle}
              handleSendRecording={handleSendRecording}
              isMock={isMock}
              handleSimulateInbound={handleSimulateInbound}
              simulating={simulating}
              handleSuggestReply={handleSuggestReply}
              suggestingReply={suggestingReply}
              showEmoji={showEmoji}
              setShowEmoji={setShowEmoji}
              setInput={setInput}
              input={input}
              fileInputRef={fileInputRef}
              handleImageSelected={handleImageSelected}
              uploadingMedia={uploadingMedia}
              orgSlug={orgSlug}
              selectedConversation={selectedConversation}
              templates={templates}
              inputRef={inputRef}
              handleComposerKeyDown={handleComposerKeyDown}
              sending={sending}
              handleMicClick={handleMicClick}
            />
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
