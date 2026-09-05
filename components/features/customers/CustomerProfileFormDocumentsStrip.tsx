'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Upload, FileText, FileImage } from 'lucide-react'
import { getDocumentSignedUrl } from '@/actions/contatos'
import type { CustomerDoc } from '@/components/features/customers/CustomerDocuments'

export const DOC_KIND_LABEL: Record<string, string> = {
  cpf: 'CPF',
  rg_front: 'RG (frente)',
  rg_back: 'RG (verso)',
  cnh: 'CNH',
  passport: 'Passaporte',
  visa: 'Visto',
  address_proof: 'Comprovante de endereço',
  contract: 'Contrato',
  other: 'Outro',
}

/** Tira horizontal, compacta, só pra visualizar o que já foi anexado —
 *  clicar num arquivo abre ele num popup; a gestão (enviar/excluir/trocar
 *  tipo) mora no popup "Gestão de documentos". */
export function DocumentsStrip({ orgSlug, documents, onManage }: { orgSlug: string; documents: CustomerDoc[]; onManage: () => void }) {
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ doc: CustomerDoc; url: string } | null>(null)

  async function openDoc(doc: CustomerDoc) {
    setOpeningId(doc.id)
    const res = await getDocumentSignedUrl(orgSlug, doc.id)
    setOpeningId(null)
    if (!res.ok) { toast.error((res as any).error || 'Não foi possível abrir'); return }
    setPreview({ doc, url: res.url })
  }

  const isImagePreview = preview ? (preview.doc.mime_type || '').startsWith('image/') : false

  return (
    <div className="flex flex-wrap items-center gap-2">
      {documents.length === 0 ? (
        <span className="text-xs text-muted-foreground">Nenhum documento anexado.</span>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {documents.map(doc => {
            const isImage = (doc.mime_type || '').startsWith('image/')
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => openDoc(doc)}
                disabled={openingId === doc.id}
                title={`Abrir ${DOC_KIND_LABEL[doc.kind] || doc.kind}`}
                className="shrink-0 w-14 h-14 rounded-md border bg-muted flex flex-col items-center justify-center gap-0.5 hover:border-primary/50 hover:bg-muted/70 transition-colors disabled:opacity-50"
              >
                {openingId === doc.id ? (
                  <Loader2 className="w-5 h-5 text-muted-foreground/60 animate-spin" />
                ) : isImage ? (
                  <FileImage className="w-5 h-5 text-muted-foreground/60" />
                ) : (
                  <FileText className="w-5 h-5 text-muted-foreground/60" />
                )}
                <span className="text-[8px] font-medium text-muted-foreground/80 truncate max-w-[52px]">
                  {DOC_KIND_LABEL[doc.kind] || doc.kind}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <Button type="button" size="sm" variant="outline" onClick={onManage}>
        <Upload className="w-3.5 h-3.5 mr-1.5" /> Gestão de documentos
      </Button>

      <Dialog open={!!preview} onOpenChange={op => { if (!op) setPreview(null) }}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{preview ? DOC_KIND_LABEL[preview.doc.kind] || preview.doc.kind : ''}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="flex-1 min-h-0 overflow-hidden rounded-md border bg-muted/20">
              {isImagePreview ? (
                <img src={preview.url} alt={DOC_KIND_LABEL[preview.doc.kind] || preview.doc.kind} className="h-full w-full object-contain" />
              ) : (
                <iframe src={preview.url} title={DOC_KIND_LABEL[preview.doc.kind] || preview.doc.kind} className="h-full w-full" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
