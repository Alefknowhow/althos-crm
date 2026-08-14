'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileText,
  FileImage,
  Trash2,
  Loader2,
  Lock,
} from 'lucide-react'
import {
  uploadCustomerDocument,
  deleteCustomerDocument,
  getDocumentSignedUrl,
} from '@/actions/contatos'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

/** Extensão curta pro selo do ícone (JPG/PNG/WEBP/PDF...), a partir do mime
 *  type (mais confiável) ou, na falta dele, do nome do arquivo. */
function fileExt(doc: Doc): string {
  const mime = doc.mime_type || ''
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
    'application/pdf': 'PDF',
  }
  if (mimeMap[mime]) return mimeMap[mime]
  const fromName = doc.file_name.split('.').pop()
  return fromName ? fromName.slice(0, 4).toUpperCase() : '?'
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
  const [docToDelete, setDocToDelete] = useState<string | null>(null)

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
              <div className="flex flex-wrap gap-3">
                {initialDocuments.map(doc => {
                  const isImage = (doc.mime_type || '').startsWith('image/')
                  const ext = fileExt(doc)
                  return (
                    <div key={doc.id} className="w-24 shrink-0 group">
                      <button
                        type="button"
                        onClick={() => openPreview(doc)}
                        className="w-24 h-24 rounded-lg border bg-muted flex flex-col items-center justify-center gap-1 relative cursor-pointer hover:border-primary/50 hover:bg-muted/70 transition-colors"
                        title="Clique para ver em tamanho completo"
                      >
                        {isImage ? (
                          <FileImage className="w-8 h-8 text-muted-foreground/50" />
                        ) : (
                          <FileText className="w-8 h-8 text-muted-foreground/50" />
                        )}
                        <span className="text-[9px] font-bold tracking-wide text-muted-foreground/70 bg-background/80 rounded px-1">
                          {ext}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDocToDelete(doc.id) }}
                          className="absolute top-1 right-1 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 p-0.5 rounded transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </button>
                      <div className="mt-1 text-center">
                        <div className="text-[10px] font-medium truncate" title={KIND_LABEL[doc.kind] || doc.kind}>
                          {KIND_LABEL[doc.kind] || doc.kind}
                        </div>
                        <div className="text-[9px] text-muted-foreground truncate">
                          {fmtSize(doc.file_size_bytes)}
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

      <AlertDialog open={!!docToDelete} onOpenChange={o => !o && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(docToDelete!); setDocToDelete(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
