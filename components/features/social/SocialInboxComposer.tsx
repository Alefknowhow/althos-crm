import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { EMOJIS, WAVEFORM_BARS } from './SocialInboxHelpers'

// Barra de composição de mensagem (texto / emojis / imagem / gravação de
// áudio) — extraído de SocialInbox.tsx. Pura movimentação de JSX.
export function SocialInboxComposer({
  handleSend, recording, recordingPaused, recordingSeconds, handleCancelRecording, handleRecordingPauseToggle,
  handleSendRecording, showEmoji, setShowEmoji, input, setInput, inputRef, fileInputRef, handleImageSelected,
  uploadingMedia, sending, handleMicClick,
}: any) {
  return (
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
          onClick={() => setShowEmoji((v: boolean) => !v)}
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
  )
}
