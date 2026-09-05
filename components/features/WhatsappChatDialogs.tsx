'use client'

import { X, Plus, Send, Pencil } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import ImageEditor from '@/components/features/ImageEditor'

type PendingImage = { file: File; caption: string; previewUrl: string }

export function WhatsappChatConfirmDialog({
  confirmAction,
  setConfirmAction,
  actionLoading,
  selectedConversation,
  handleConfirmedAction,
}: {
  confirmAction: 'clear' | 'delete' | 'block' | null
  setConfirmAction: (v: 'clear' | 'delete' | 'block' | null) => void
  actionLoading: boolean
  selectedConversation: any
  handleConfirmedAction: () => void
}) {
  return (
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
  )
}

export function WhatsappChatImageComposerDialog({
  pendingImages,
  closeImageComposer,
  editingImage,
  setEditingImage,
  composerIndex,
  setComposerIndex,
  handleApplyEditedImage,
  removePendingImage,
  composerFileInputRef,
  handleComposerAddMore,
  setPendingImages,
  handleSendImageQueue,
  sendingQueue,
}: {
  pendingImages: PendingImage[]
  closeImageComposer: () => void
  editingImage: boolean
  setEditingImage: (v: boolean) => void
  composerIndex: number
  setComposerIndex: (v: number) => void
  handleApplyEditedImage: (edited: File) => void
  removePendingImage: (index: number) => void
  composerFileInputRef: React.RefObject<HTMLInputElement>
  handleComposerAddMore: (e: React.ChangeEvent<HTMLInputElement>) => void
  setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>
  handleSendImageQueue: () => void
  sendingQueue: boolean
}) {
  return (
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
  )
}

export function WhatsappChatLightboxDialog({
  lightboxUrl,
  setLightboxUrl,
}: {
  lightboxUrl: string | null
  setLightboxUrl: (v: string | null) => void
}) {
  return (
    <Dialog open={!!lightboxUrl} onOpenChange={o => !o && setLightboxUrl(null)}>
      <DialogContent className="max-w-3xl p-2 bg-black/95 border-none">
        {lightboxUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lightboxUrl} alt="" className="w-full max-h-[85vh] object-contain rounded" />
        )}
      </DialogContent>
    </Dialog>
  )
}
