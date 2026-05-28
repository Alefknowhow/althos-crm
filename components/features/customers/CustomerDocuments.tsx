'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Loader2,
  Image as ImageIcon,
  Lock,
} from 'lucide-react'
import {
  uploadCustomerDocument,
  deleteCustomerDocument,
  getDocumentSignedUrl,
} from '@/actions/customers'

type Doc = {
  id: string
  kind: string
  file_path: string
  file_name: string
  file_size_bytes: number | null
  mime_type: string | null
  created_at: string
}

const KIND_LABEL: Record<string, string> = {
  cpf_front: 'CPF (frente)',
  cpf_back: 'CPF (verso)',
  rg_front: 'RG (frente)',
  rg_back: 'RG (verso)',
  address_proof: 'Comprovante de endereço',
  contract: 'Contrato',
  other: 'Outro',
}

const KIND_OPTIONS = [
  'cpf_front',
  'cpf_back',
  'rg_front',
  'rg_back',
  'address_proof',
  'contract',
  'other',
] as const

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function CustomerDocuments({
  orgSlug,
  leadId,
  profileId,
  initialDocuments,
}: {
  orgSlug: string
  leadId: string
  profileId: string | null
  initialDocuments: Doc[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<string>('cpf_front')
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<{ url: string; mime: string } | null>(null)

  // If no profile exists yet (operator hasn't saved address fields), show a
  // gentle prompt — Storage upload requires the profile id as part of the
  // path. They save profile first → reload → can upload.
  const profileMissing = !profileId

  async function handleFile(file: File) {
    if (!profileId) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    const res = await uploadCustomerDocument(orgSlug, profileId, fd)
    setUploading(false)
    if (res.ok) {
      toast.success('Documento enviado')
      startTransition(() => router.refresh())
    } else {
      toast.error(res.error)
    }
  }

  async function handleDelete(docId: string) {
    if (!window.confirm('Excluir esse documento? Esta ação é permanente.')) return
    const res = await deleteCustomerDocument(orgSlug, docId)
    if (res.ok) {
      toast.success('Documento removido')
      startTransition(() => router.refresh())
    } else {
      toast.error(res.error)
    }
  }

  async function openPreview(doc: Doc) {
    const res = await getDocumentSignedUrl(orgSlug, doc.id)
    if (!res.ok) {
      toast.error(res.error || 'Não foi possível abrir')
      return
    }
    setPreviewUrl({ url: res.url, mime: doc.mime_type || 'image/png' })
  }

  // Close preview on ESC for keyboard users.
  useEffect(() => {
    if (!previewUrl) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreviewUrl(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewUrl])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Documentos
          <Lock className="w-3 h-3 text-muted-foreground" />
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Arquivos privados — só membros da sua org podem ver. Links de visualização expiram em 5 min.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {profileMissing ? (
          <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-md p-3 text-xs text-amber-800 dark:text-amber-300">
            Salve o cadastro do cliente acima primeiro pra habilitar o envio de documentos.
          </div>
        ) : (
          <>
            {/* Upload control */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={kind}
                onChange={e => setKind(e.target.value)}
                disabled={uploading}
              >
                {KIND_OPTIONS.map(k => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Enviar documento
                  </>
                )}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                PNG, JPG, WebP ou PDF — até 10MB
              </span>
            </div>

            {/* Grid of documents */}
            {initialDocuments.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                Nenhum documento enviado.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {initialDocuments.map(doc => {
                  const isImage = (doc.mime_type || '').startsWith('image/')
                  return (
                    <div
                      key={doc.id}
                      className="border rounded-lg overflow-hidden group hover:border-primary/50 transition-colors"
                    >
                      <div className="aspect-square bg-muted flex items-center justify-center relative">
                        {isImage ? (
                          <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                        ) : (
                          <FileText className="w-10 h-10 text-muted-foreground/40" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openPreview(doc)}
                            className="bg-white text-black hover:bg-white/90"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                          </Button>
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        <div className="text-xs font-medium truncate">
                          {KIND_LABEL[doc.kind] || doc.kind}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {doc.file_name}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {fmtSize(doc.file_size_bytes)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id)}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Preview overlay — signed URL renders inline (image) or in iframe (pdf) */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-background rounded-lg overflow-hidden max-w-4xl max-h-[90vh] w-full"
            onClick={e => e.stopPropagation()}
          >
            {previewUrl.mime.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl.url} alt="Documento" className="max-h-[90vh] w-full object-contain" />
            ) : (
              <iframe src={previewUrl.url} className="w-full h-[80vh]" title="Documento" />
            )}
            <div className="p-2 flex justify-between items-center bg-muted/30 text-xs">
              <span className="text-muted-foreground">Link expira em 5 minutos</span>
              <Button size="sm" variant="ghost" onClick={() => setPreviewUrl(null)}>
                Fechar (ESC)
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
