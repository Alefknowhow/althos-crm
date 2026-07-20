'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getAttachmentTemplateUrl, uploadAttachmentTemplate, removeAttachmentTemplate,
  type AttachmentDocumentType,
} from '@/actions/attachment-templates'
import { toast } from 'sonner'
import { FileIcon, Upload, Download, X, Loader2 } from 'lucide-react'

export default function AttachmentTemplateView({
  orgSlug, documentType, templateInfo, children,
}: {
  orgSlug: string
  documentType: AttachmentDocumentType
  templateInfo: { name: string } | null
  children?: React.ReactNode
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [opening, setOpening] = useState(false)

  async function handleUpload(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadAttachmentTemplate(orgSlug, documentType, fd)
    setUploading(false)
    if (res.ok) { toast.success('Modelo enviado'); router.refresh() }
    else toast.error(res.error)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDownload() {
    setOpening(true)
    const res = await getAttachmentTemplateUrl(orgSlug, documentType)
    setOpening(false)
    if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer')
    else toast.error(res.error)
  }

  async function handleRemove() {
    const res = await removeAttachmentTemplate(orgSlug, documentType)
    if (res.ok) { toast.success('Modelo removido'); router.refresh() }
    else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileIcon className="w-4 h-4 text-primary" /> Modelo em PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Este formulário exige assinatura física do médico/passageiro — não é gerado pelo sistema.
            Envie aqui o modelo em branco da operadora pra deixar disponível para download pela equipe.
          </p>
          {templateInfo ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <FileIcon className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm">{templateInfo.name}</span>
              <Button variant="outline" size="sm" disabled={opening} onClick={handleDownload}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleRemove} aria-label="Remover modelo">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Enviar modelo</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {children && (
        <Card>
          <CardContent className="pt-6 prose prose-sm max-w-none">
            {children}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
