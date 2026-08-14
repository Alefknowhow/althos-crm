'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, FileSignature, Send, Download, Eye, RefreshCw, CheckCircle2, Mail } from 'lucide-react'
import {
  getSaleContract,
  uploadContractPdf,
  sendContractForSignature,
  refreshContractStatus,
  getContractFileUrl,
  sendContractLinkByEmail,
} from '@/actions/contracts'

type Props = {
  orgSlug: string
  saleId: string
  clientName: string | null
  clientEmail?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho — PDF gerado, ainda não enviado',
  sent: 'Enviado — aguardando assinatura',
  signed: 'Assinado',
  rejected: 'Recusado',
}

export default function ContratoManagerDialog({ orgSlug, saleId, clientName, clientEmail, open, onOpenChange }: Props) {
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [signerName, setSignerName] = useState(clientName || '')
  const [signerEmail, setSignerEmail] = useState(clientEmail || '')
  const [signerPhone, setSignerPhone] = useState('')
  const [emailTo, setEmailTo] = useState(clientEmail || '')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getSaleContract(orgSlug, saleId).then(c => {
      setContract(c)
      setLoading(false)
    })
  }, [open, orgSlug, saleId])

  async function reload() {
    const c = await getSaleContract(orgSlug, saleId)
    setContract(c)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.left = '-10000px'
      iframe.style.top = '0'
      iframe.style.width = '900px'
      iframe.style.height = '1200px'
      document.body.appendChild(iframe)

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Tempo esgotado ao carregar o contrato.')), 20000)
        iframe.onload = () => {
          clearTimeout(timeout)
          setTimeout(resolve, 800) // dá tempo pras fontes/imagens renderizarem
        }
        iframe.src = `/app/${orgSlug}/reservas/${saleId}/contrato`
      })

      const doc = iframe.contentDocument
      const target = doc?.querySelector('.max-w-\\[210mm\\].bg-white') as HTMLElement | null
      if (!doc || !target) throw new Error('Não foi possível localizar o conteúdo do contrato.')

      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      document.body.removeChild(iframe)

      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = 210
      const pageHeight = 297
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0
      const imgData = canvas.toDataURL('image/jpeg', 0.92)

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const base64 = pdf.output('datauristring').split(',')[1]
      const res = await uploadContractPdf(orgSlug, saleId, base64)
      if (!res.ok) {
        toast.error(res.error)
      } else {
        toast.success('PDF do contrato gerado.')
        await reload()
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PDF do contrato.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSend() {
    if (!signerName.trim()) {
      toast.error('Informe o nome do signatário.')
      return
    }
    setSending(true)
    const res = await sendContractForSignature(orgSlug, saleId, {
      name: signerName.trim(),
      email: signerEmail.trim() || undefined,
      phone: signerPhone.trim() || undefined,
    })
    setSending(false)
    if (!res.ok) {
      toast.error(res.error)
    } else {
      toast.success('Contrato enviado para assinatura.')
      await reload()
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    const res = await refreshContractStatus(orgSlug, saleId)
    setRefreshing(false)
    if (!res.ok) {
      toast.error(res.error)
    } else {
      toast.success(res.status === 'signed' ? 'Contrato assinado!' : 'Ainda aguardando assinatura.')
      await reload()
    }
  }

  async function handleView(which: 'pdf' | 'signed') {
    const res = await getContractFileUrl(orgSlug, saleId, which)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    window.open(res.url, '_blank')
  }

  async function handleSendEmail() {
    if (!emailTo.trim()) {
      toast.error('Informe o e-mail de destino.')
      return
    }
    const res = await sendContractLinkByEmail(orgSlug, saleId, emailTo.trim())
    if (!res.ok) toast.error(res.error)
    else toast.success('Link enviado por e-mail.')
  }

  const status = contract?.status as string | undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5" /> Contrato
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            {status && (
              <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${status === 'signed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' : 'bg-muted text-muted-foreground'}`}>
                {status === 'signed' && <CheckCircle2 className="w-4 h-4" />}
                {STATUS_LABEL[status] || status}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSignature className="w-4 h-4 mr-1.5" />}
                {contract?.pdf_path ? 'Gerar novamente' : 'Gerar PDF'}
              </Button>
              {contract?.pdf_path && (
                <Button size="sm" variant="outline" onClick={() => handleView('pdf')}>
                  <Eye className="w-4 h-4 mr-1.5" /> Ver PDF
                </Button>
              )}
              {status === 'signed' && contract?.signed_pdf_path && (
                <Button size="sm" variant="outline" onClick={() => handleView('signed')}>
                  <Download className="w-4 h-4 mr-1.5" /> Baixar assinado
                </Button>
              )}
              {status === 'sent' && (
                <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                  Atualizar status
                </Button>
              )}
            </div>

            {contract?.pdf_path && status !== 'signed' && (
              <div className="space-y-3 border rounded-lg p-3">
                <p className="text-sm font-medium">Enviar para assinatura</p>
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do signatário</Label>
                    <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone (WhatsApp) — opcional se preencher e-mail</Label>
                    <Input value={signerPhone} onChange={e => setSignerPhone(e.target.value)} placeholder="5511999999999" />
                  </div>
                </div>
                <Button size="sm" onClick={handleSend} disabled={sending} className="w-full">
                  {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                  Enviar para assinatura (Autentique)
                </Button>
              </div>
            )}

            {contract?.signature_link && status === 'sent' && (
              <div className="space-y-2 border rounded-lg p-3">
                <p className="text-sm font-medium">Atalhos — reenviar link de assinatura</p>
                <div className="flex gap-2">
                  <Input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="email@exemplo.com" className="text-xs" />
                  <Button size="sm" variant="outline" onClick={handleSendEmail}>
                    <Mail className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Para enviar por WhatsApp, use o botão de atalho na conversa do cliente em Conversas.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
