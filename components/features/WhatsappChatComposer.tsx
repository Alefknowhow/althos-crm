'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Sparkles, Loader2 } from 'lucide-react'
import ScheduleMessageButton from '@/components/features/ScheduleMessageButton'
import { WAVEFORM_BARS, EMOJIS } from './WhatsappChatWidgets'

export default function WhatsappChatComposer({
  handleSend, recording, recordingPaused, recordingSeconds,
  handleCancelRecording, handleRecordingPauseToggle, handleSendRecording,
  isMock, handleSimulateInbound, simulating,
  handleSuggestReply, suggestingReply,
  showEmoji, setShowEmoji, setInput, input,
  fileInputRef, handleImageSelected, uploadingMedia,
  orgSlug, selectedConversation, templates,
  inputRef, handleComposerKeyDown,
  sending, handleMicClick,
}: any) {
  return (
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
          onClick={() => setShowEmoji((v: boolean) => !v)}
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
                  onClick={() => { setInput((prev: string) => prev + e); setShowEmoji(false) }}
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
  )
}
