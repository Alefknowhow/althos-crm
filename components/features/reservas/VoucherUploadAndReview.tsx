'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Sparkles, FileIcon, ImageIcon } from 'lucide-react'
import { uploadSaleVoucher } from '@/actions/upload'
import VoucherExtractDialog, { type ExtractSource } from '@/components/features/reservas/VoucherExtractDialog'
import type { TravelSaleRow } from '@/actions/travel-sales'

type Voucher = { url: string; name: string }
type PendingFile = { file: File; name: string }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Upload de voucher (aceita mais de um) — cada arquivo enviado ganha um
 * botão "Ler dados" que abre o popup de revisão (VoucherExtractDialog),
 * onde cada produto identificado (voo/hospedagem/cruzeiro/etc.) é
 * adicionado individualmente aos Produtos da reserva.
 */
export default function VoucherUploadAndReview({
  orgSlug, sale, onVoucherAdded, onScalarFieldsExtracted, onProductsCreated,
}: {
  orgSlug: string
  sale: TravelSaleRow
  onVoucherAdded: (v: Voucher) => void
  onScalarFieldsExtracted: (patch: Record<string, any>) => void
  onProductsCreated: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [readingFor, setReadingFor] = useState<string | null>(null)
  const [dialogSource, setDialogSource] = useState<ExtractSource | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const newlyUploaded: PendingFile[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadSaleVoucher(orgSlug, fd)
      if (res.ok) { onVoucherAdded({ url: res.url, name: res.name }); newlyUploaded.push({ file, name: res.name }) }
      else toast.error(`${file.name}: ${res.error}`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    setPendingFiles(prev => [...prev, ...newlyUploaded])
  }

  async function handleReadData(pf: PendingFile) {
    setReadingFor(pf.name)
    try {
      const base64 = await fileToBase64(pf.file)
      setDialogSource({ base64, mediaType: pf.file.type })
      setDialogOpen(true)
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao ler o arquivo.')
    } finally {
      setReadingFor(null)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <div className="rounded-lg border-2 border-dashed p-4 text-center space-y-2">
        <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Adicionar voucher</p>
        <p className="text-xs text-muted-foreground">PDF, JPG ou PNG — aceita mais de um arquivo por reserva.</p>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Selecionar arquivo</>}
        </Button>
      </div>

      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          {pendingFiles.map((pf, i) => {
            const isPdf = /\.pdf$/i.test(pf.name)
            const busy = readingFor === pf.name
            return (
              <div key={`${pf.name}-${i}`} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                {isPdf ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                <span className="flex-1 min-w-0 truncate text-sm">{pf.name}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0" disabled={busy} onClick={() => handleReadData(pf)}>
                  {busy ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Lendo…</> : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Ler dados</>}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <VoucherExtractDialog
        orgSlug={orgSlug}
        saleId={sale.id}
        source={dialogSource}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onScalarFieldsExtracted={onScalarFieldsExtracted}
        onProductCreated={onProductsCreated}
      />
    </div>
  )
}
