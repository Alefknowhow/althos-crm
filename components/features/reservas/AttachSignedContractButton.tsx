'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { attachSignedContract } from '@/actions/travel-sales'
import { uploadSaleVoucher } from '@/actions/upload'
import { toast } from 'sonner'
import { Upload, Loader2, CheckCircle2 } from 'lucide-react'

/**
 * Assinatura eletrônica real (Clicksign/Autentique/DocuSign) fica pra uma
 * leva futura — por ora, o contrato é assinado fora do sistema e o PDF
 * assinado é anexado aqui, indo pro mesmo array de vouchers/comprovantes
 * já exibido em Reservas.
 */
export default function AttachSignedContractButton({ orgSlug, saleId }: { orgSlug: string; saleId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const uploadRes = await uploadSaleVoucher(orgSlug, fd)
    if (!uploadRes.ok) {
      setUploading(false)
      toast.error(uploadRes.error)
      return
    }
    const res = await attachSignedContract(orgSlug, saleId, { url: uploadRes.url, name: uploadRes.name })
    setUploading(false)
    if (!res.ok) { toast.error(res.error); return }
    setDone(true)
    toast.success('Contrato assinado anexado em Vouchers/comprovantes da venda.')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="print:hidden">
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading
          ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Enviando…</>
          : done
            ? <><CheckCircle2 className="w-4 h-4 mr-1.5 text-success" /> Contrato assinado anexado</>
            : <><Upload className="w-4 h-4 mr-1.5" /> Anexar contrato assinado</>}
      </Button>
    </div>
  )
}
