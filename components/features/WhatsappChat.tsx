'use client'

import ConversationDetailPanel from '@/components/features/ConversationDetailPanel'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog } from '@/components/features/pipeline/StageMoveDialogs'
import {
  WhatsappChatConfirmDialog, WhatsappChatImageComposerDialog, WhatsappChatLightboxDialog,
} from './WhatsappChatDialogs'
import WhatsappChatSidebar from './WhatsappChatSidebar'
import WhatsappChatComposer from './WhatsappChatComposer'
import WhatsappChatHeader from './WhatsappChatHeader'
import WhatsappChatMessagesPane from './WhatsappChatMessagesPane'
import { useWhatsappChatState } from './useWhatsappChatState'
import { toast } from 'sonner'

export default function WhatsappChat({ orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages, members = [], panelContext, scheduled = [], templates = [], emailTemplates = [], orgName, isMock, pipelineStages = [], aiEnabledGlobally = false }: any) {
  const s = useWhatsappChatState({
    orgSlug, orgId, conversations: conversationsProp, selectedConversation, initialMessages, members, pipelineStages,
  })

  // Etapa do funil do lead vinculado (para a tag compacta no cabeçalho).
  const stageName: string | null = panelContext?.lead?.pipeline_stages?.name ?? null

  return (
    <div className="flex w-full h-full border-t">
      <WhatsappChatSidebar
        orgSlug={orgSlug}
        isMock={isMock}
        seeding={s.seeding}
        handleSeed={s.handleSeed}
        query={s.query}
        setQuery={s.setQuery}
        showFilters={s.showFilters}
        setShowFilters={s.setShowFilters}
        activeFilters={s.activeFilters}
        filterSeller={s.filterSeller}
        setFilterSeller={s.setFilterSeller}
        filterStage={s.filterStage}
        setFilterStage={s.setFilterStage}
        sellerOptions={s.sellerOptions}
        stageOptions={s.stageOptions}
        filteredConversations={s.filteredConversations}
        conversations={s.conversations}
        selectedConversation={selectedConversation}
        router={s.router}
        aiEnabledGlobally={aiEnabledGlobally}
        members={members}
        pipelineStages={pipelineStages}
        memberById={s.memberById}
        handleQuickAssign={s.handleQuickAssign}
        handleQuickStageChange={s.handleQuickStageChange}
        now={s.now}
      />

      <div
        className={`relative flex-1 min-w-0 flex-col overflow-x-hidden bg-[#efeae2] dark:bg-[#0b141a] ${selectedConversation ? 'flex' : 'hidden md:flex'}`}
        onDragOver={e => { if (selectedConversation) { e.preventDefault(); s.setDraggingFile(true) } }}
        onDragLeave={e => { if (e.currentTarget === e.target) s.setDraggingFile(false) }}
        onDrop={e => {
          e.preventDefault()
          s.setDraggingFile(false)
          if (!selectedConversation) return
          const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'))
          if (files.length === 0) { toast.error('Solte um arquivo de imagem (JPG, PNG ou WEBP).'); return }
          s.queueImages(files)
        }}
      >
        {selectedConversation && s.draggingFile && (
          <div className="absolute inset-0 z-30 bg-primary/10 border-4 border-dashed border-primary flex items-center justify-center pointer-events-none">
            <div className="bg-background rounded-lg px-6 py-4 shadow-lg text-sm font-medium">Solte a imagem para enviar</div>
          </div>
        )}
        {selectedConversation ? (
          <>
            <WhatsappChatHeader
              orgSlug={orgSlug}
              router={s.router}
              selectedConversation={selectedConversation}
              stageName={stageName}
              lastSeen={s.lastSeen}
              aiEnabledGlobally={aiEnabledGlobally}
              pausingAi={s.pausingAi}
              handleToggleAi={s.handleToggleAi}
              showSearch={s.showSearch}
              setShowSearch={s.setShowSearch}
              setMsgQuery={s.setMsgQuery}
              handleToggleFlag={s.handleToggleFlag}
              handleMarkUnread={s.handleMarkUnread}
              setConfirmAction={s.setConfirmAction}
            />

            <WhatsappChatMessagesPane
              showSearch={s.showSearch}
              setShowSearch={s.setShowSearch}
              msgQuery={s.msgQuery}
              setMsgQuery={s.setMsgQuery}
              visibleMessages={s.visibleMessages}
              orgSlug={orgSlug}
              setLightboxUrl={s.setLightboxUrl}
              messagesEndRef={s.messagesEndRef}
              scheduled={scheduled}
              handleCancelScheduled={s.handleCancelScheduled}
            />

            <WhatsappChatComposer
              handleSend={s.handleSend}
              recording={s.recording}
              recordingPaused={s.recordingPaused}
              recordingSeconds={s.recordingSeconds}
              handleCancelRecording={s.handleCancelRecording}
              handleRecordingPauseToggle={s.handleRecordingPauseToggle}
              handleSendRecording={s.handleSendRecording}
              isMock={isMock}
              handleSimulateInbound={s.handleSimulateInbound}
              simulating={s.simulating}
              handleSuggestReply={s.handleSuggestReply}
              suggestingReply={s.suggestingReply}
              showEmoji={s.showEmoji}
              setShowEmoji={s.setShowEmoji}
              setInput={s.setInput}
              input={s.input}
              fileInputRef={s.fileInputRef}
              handleImageSelected={s.handleImageSelected}
              uploadingMedia={s.uploadingMedia}
              orgSlug={orgSlug}
              selectedConversation={selectedConversation}
              templates={templates}
              inputRef={s.inputRef}
              handleComposerKeyDown={s.handleComposerKeyDown}
              sending={s.sending}
              handleMicClick={s.handleMicClick}
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
          open={s.panelOpen}
          onToggle={() => s.setPanelOpen((o: boolean) => !o)}
        />
      )}

      <WhatsappChatConfirmDialog
        confirmAction={s.confirmAction}
        setConfirmAction={s.setConfirmAction}
        actionLoading={s.actionLoading}
        selectedConversation={selectedConversation}
        handleConfirmedAction={s.handleConfirmedAction}
      />

      {/* Revisão de imagem(ns) antes de enviar — igual ao WhatsApp normal:
          abre em vez de mandar direto ao colar/arrastar/selecionar. */}
      <WhatsappChatImageComposerDialog
        pendingImages={s.pendingImages}
        closeImageComposer={s.closeImageComposer}
        editingImage={s.editingImage}
        setEditingImage={s.setEditingImage}
        composerIndex={s.composerIndex}
        setComposerIndex={s.setComposerIndex}
        handleApplyEditedImage={s.handleApplyEditedImage}
        removePendingImage={s.removePendingImage}
        composerFileInputRef={s.composerFileInputRef}
        handleComposerAddMore={s.handleComposerAddMore}
        setPendingImages={s.setPendingImages}
        handleSendImageQueue={s.handleSendImageQueue}
        sendingQueue={s.sendingQueue}
      />

      {/* Ampliar imagem recebida/enviada — popup em vez de nova aba. */}
      <WhatsappChatLightboxDialog lightboxUrl={s.lightboxUrl} setLightboxUrl={s.setLightboxUrl} />

      <LostMoveDialog
        open={s.quickStagePrompt?.kind === 'lost'}
        onCancel={() => s.setQuickStagePrompt(null)}
        onConfirm={(dealStatus, reason) => {
          if (s.quickStagePrompt) s.commitQuickStageChange(s.quickStagePrompt.contatoId, s.quickStagePrompt.currentStageId, s.quickStagePrompt.newStageId, { dealStatus, reason })
          s.setQuickStagePrompt(null)
        }}
      />
      <WonValueDialog
        open={s.quickStagePrompt?.kind === 'won'}
        defaultCents={s.quickStagePrompt?.defaultCents}
        onCancel={() => s.setQuickStagePrompt(null)}
        onConfirm={valueCents => {
          if (s.quickStagePrompt) s.commitQuickStageChange(s.quickStagePrompt.contatoId, s.quickStagePrompt.currentStageId, s.quickStagePrompt.newStageId, undefined, valueCents)
          s.setQuickStagePrompt(null)
        }}
      />
      <NegotiationValueDialog
        open={s.quickStagePrompt?.kind === 'negotiation'}
        defaultCents={s.quickStagePrompt?.defaultCents}
        onCancel={() => s.setQuickStagePrompt(null)}
        onConfirm={valueCents => {
          if (s.quickStagePrompt) s.commitQuickStageChange(s.quickStagePrompt.contatoId, s.quickStagePrompt.currentStageId, s.quickStagePrompt.newStageId, undefined, valueCents)
          s.setQuickStagePrompt(null)
        }}
      />
    </div>
  )
}
