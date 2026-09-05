'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  sendManualMessage,
  toggleAutomationPause,
  markConversationRead,
  setSocialConversationBlocked,
  markSocialConversationAsUnread,
  clearSocialConversationMessages,
  deleteSocialConversation,
  type SocialConversationRow,
  type SocialMessageRow,
} from '@/actions/social-inbox'
import SocialLeadDetailPanel from '@/components/features/social/SocialLeadDetailPanel'
import { ConfirmActionDialog, ImageComposerDialog, LightboxDialog } from './SocialInboxDialogs'
import { SocialInboxSidebar } from './SocialInboxSidebar'
import { SocialInboxHeader } from './SocialInboxHeader'
import { SocialInboxMessagesPane } from './SocialInboxMessagesPane'
import { SocialInboxComposer } from './SocialInboxComposer'
import { useSocialInboxMediaState } from './useSocialInboxMediaState'
import { useSocialInboxRealtime } from './useSocialInboxRealtime'

type Props = {
  orgSlug: string
  orgId?: string
  conversations: SocialConversationRow[]
  selectedConversation: SocialConversationRow | null
  initialMessages: SocialMessageRow[]
  justConnected?: boolean
  /** Alimentam o painel "Detalhes do lead" (SocialLeadDetailPanel) — mesma
   *  estrutura tabulada usada no WhatsApp. Todos opcionais pra não quebrar
   *  quem ainda não passa esses props. */
  members?: { user_id: string; name: string; email: string }[]
  panelContext?: any
  emailTemplates?: any[]
  orgName?: string
}

export default function SocialInbox({ orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages, justConnected, members = [], panelContext, emailTemplates = [], orgName }: Props) {
  const [panelOpen, setPanelOpen] = useState(true)
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
  const supabase = useMemo(() => createClient(), [])

  const media = useSocialInboxMediaState({ orgSlug, selectedConversation, router })
  const [draggingFile, setDraggingFile] = useState(false)
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

  useSocialInboxRealtime({ supabase, orgId, orgSlug, selectedConversation, messagesEndRef, setMessages, setConversations })

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
      <SocialInboxSidebar
        filteredConversations={filteredConversations}
        totalCount={conversations.length}
        selectedConversation={selectedConversation}
        query={query}
        setQuery={setQuery}
        onSelect={id => router.push(`/app/${orgSlug}/social/inbox?id=${id}`)}
      />

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
          media.queueImages(files)
        }}
      >
        {selectedConversation && draggingFile && (
          <div className="absolute inset-0 z-30 bg-[#3797f0]/10 border-4 border-dashed border-[#3797f0] flex items-center justify-center pointer-events-none">
            <div className="bg-background rounded-lg px-6 py-4 shadow-lg text-sm font-medium">Solte a imagem para enviar</div>
          </div>
        )}
        {selectedConversation ? (
          <>
            <SocialInboxHeader
              orgSlug={orgSlug}
              router={router}
              selectedConversation={selectedConversation}
              pausing={pausing}
              handleTogglePause={handleTogglePause}
              handleToggleFlag={handleToggleFlag}
              handleMarkUnread={handleMarkUnread}
              setConfirmAction={setConfirmAction}
            />

            <SocialInboxMessagesPane
              messages={messages}
              setLightboxUrl={setLightboxUrl}
              messagesEndRef={messagesEndRef}
            />

            <SocialInboxComposer
              handleSend={handleSend}
              recording={media.recording}
              recordingPaused={media.recordingPaused}
              recordingSeconds={media.recordingSeconds}
              handleCancelRecording={media.handleCancelRecording}
              handleRecordingPauseToggle={media.handleRecordingPauseToggle}
              handleSendRecording={media.handleSendRecording}
              showEmoji={showEmoji}
              setShowEmoji={setShowEmoji}
              input={input}
              setInput={setInput}
              inputRef={inputRef}
              fileInputRef={media.fileInputRef}
              handleImageSelected={media.handleImageSelected}
              uploadingMedia={media.uploadingMedia}
              sending={sending}
              handleMicClick={media.handleMicClick}
            />
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

      <ConfirmActionDialog
        confirmAction={confirmAction}
        setConfirmAction={setConfirmAction}
        selectedConversation={selectedConversation}
        actionLoading={actionLoading}
        onConfirm={handleConfirmedAction}
      />

      {/* Revisão de imagem(ns) antes de enviar — igual ao WhatsApp normal. */}
      <ImageComposerDialog
        pendingImages={media.pendingImages}
        setPendingImages={media.setPendingImages}
        composerIndex={media.composerIndex}
        setComposerIndex={media.setComposerIndex}
        editingImage={media.editingImage}
        setEditingImage={media.setEditingImage}
        closeImageComposer={media.closeImageComposer}
        handleApplyEditedImage={media.handleApplyEditedImage}
        removePendingImage={media.removePendingImage}
        composerFileInputRef={media.composerFileInputRef}
        handleComposerAddMore={media.handleComposerAddMore}
        sendingQueue={media.sendingQueue}
        handleSendImageQueue={media.handleSendImageQueue}
      />

      {/* Ampliar imagem recebida/enviada — popup em vez de nova aba. */}
      <LightboxDialog lightboxUrl={lightboxUrl} setLightboxUrl={setLightboxUrl} />

      {selectedConversation && (
        <SocialLeadDetailPanel
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
    </div>
  )
}
