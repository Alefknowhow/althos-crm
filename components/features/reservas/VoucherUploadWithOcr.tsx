'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Sparkles } from 'lucide-react'
import { uploadSaleVoucher } from '@/actions/upload'
import { extractTravelDocument } from '@/actions/document-extract'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'

type Voucher = { url: string; name: string }

/**
 * Upload de voucher + leitura por IA num só clique — usado tanto no "Nova
 * venda" (venda ainda não existe, `uploadSaleVoucher` não depende de
 * `saleId`) quanto no botão "Add voucher" de uma venda já existente. A
 * leitura é opcional na prática: se falhar, o voucher já enviado não se
 * perde, só não vem com autopreenchimento.
 */
export default function VoucherUploadWithOcr({
  orgSlug, onExtracted, label = 'Add voucher', variant = 'outline',
}: {
  orgSlug: string
  onExtracted: (result: { voucher: Voucher; extracted: ExtractedTravelDocument | null }) => void
  label?: string
  variant?: 'outline' | 'default'
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'ocr' | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy('upload')
    const fd = new FormData()
    fd.append('file', file)
    const uploadRes = await uploadSaleVoucher(orgSlug, fd)
    if (!uploadRes.ok) {
      toast.error(uploadRes.error)
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const voucher: Voucher = { url: uploadRes.url, name: uploadRes.name }

    setBusy('ocr')
    let extracted: ExtractedTravelDocument | null = null
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || '')
          const comma = result.indexOf(',')
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const ocrRes = await extractTravelDocument(orgSlug, { base64, mediaType: file.type || 'application/pdf' })
      if (ocrRes.ok) extracted = ocrRes.data
      else toast.warning(`Voucher salvo, mas a leitura automática falhou: ${ocrRes.error}`)
    } catch {
      toast.warning('Voucher salvo, mas a leitura automática falhou.')
    }

    setBusy(null)
    if (fileRef.current) fileRef.current.value = ''
    onExtracted({ voucher, extracted })
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <Button type="button" variant={variant} size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
        {busy === 'upload' && <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</>}
        {busy === 'ocr' && <><Sparkles className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Lendo voucher…</>}
        {!busy && <><Upload className="w-3.5 h-3.5 mr-1.5" /> {label}</>}
      </Button>
    </>
  )
}
