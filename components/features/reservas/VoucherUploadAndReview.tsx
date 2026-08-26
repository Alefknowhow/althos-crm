'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import { uploadSaleVoucher } from '@/actions/upload'

type Voucher = { url: string; name: string }

/**
 * Upload de voucher (aceita mais de um arquivo por reserva) — só faz o
 * upload. A leitura/extração de dados acontece pelo botão "Extrair dados"
 * na lista de vouchers já enviados (aba Vouchers), pra não duplicar a
 * mesma ação em dois lugares da tela.
 */
export default function VoucherUploadAndReview({
  orgSlug, onVoucherAdded,
}: {
  orgSlug: string
  onVoucherAdded: (v: Voucher) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadSaleVoucher(orgSlug, fd)
      if (res.ok) onVoucherAdded({ url: res.url, name: res.name })
      else toast.error(`${file.name}: ${res.error}`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="rounded-lg border-2 border-dashed p-4 text-center space-y-2">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
      <p className="text-sm font-medium">Adicionar voucher</p>
      <p className="text-xs text-muted-foreground">PDF, JPG ou PNG — aceita mais de um arquivo por reserva.</p>
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Selecionar arquivo</>}
      </Button>
    </div>
  )
}
