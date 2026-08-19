'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2, FileSignature, Send, Download, Eye, RefreshCw, CheckCircle2,
  Mail, FileText, Clock, XCircle, Copy, Settings2,
} from 'lucide-react'
import Link from 'next/link'
import {
  getSaleContract,
  uploadContractPdf,
  sendContractForSignature,
  refreshContractStatus,
  getContractFileUrl,
  sendContractLinkByEmail,
  getContractRenderData,
} from '@/actions/contracts'
import ContractPrintView from '@/components/features/reservas/ContractPrintView'
import ContractTemplatePrintView from '@/components/features/reservas/ContractTemplatePrintView'

type Props = {
  orgSlug: string
  saleId: string
  clientName: string | null
  clientEmail?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  draft:    { label: 'Rascunho',              className: 'bg-muted text-muted-foreground',                                   icon: FileText },
  sent:     { label: 'Aguardando assinatura', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',       icon: Clock },
  signed:   { label: 'Assinado',              className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Recusado',              className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',              icon: XCircle },
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
  const [signer2Name, setSigner2Name] = useState('')
  const [signer2Email, setSigner2Email] = useState('')
  const [signer2Phone, setSigner2Phone] = useState('')
  const [emailTo, setEmailTo] = useState(clientEmail || '')
  const [renderData, setRenderData] = useState<any>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getSaleContract(orgSlug, saleId).then(c => {
      setContract(c)
      setSignerName(prev => c?.signer_name || prev)
      setSignerEmail(prev => c?.signer_email || prev)
      setSignerPhone(prev => c?.signer_phone || prev)
      setSigner2Name(prev => c?.signer2_name || prev)
      setSigner2Email(prev => c?.signer2_email || prev)
      setSigner2Phone(prev => c?.signer2_phone || prev)
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
      const data = await getContractRenderData(orgSlug, saleId)
      if (!data.ok) throw new Error(data.error)

      // Monta o mesmo componente da página de impressão fora da tela (não dá
      // pra usar um <iframe> pra essa página — a CSP do app bloqueia
      // frame-ancestors mesmo same-origin) e espera o React commitar antes
      // de capturar, pra garantir que o DOM já existe no momento do html2canvas.
      flushSync(() => setRenderData(data))
      await new Promise(resolve => setTimeout(resolve, 500)) // fontes/imagens/logo

      const container = captureRef.current
      const target = container?.querySelector('.max-w-\\[210mm\\].bg-white') as HTMLElement | null
      if (!target) throw new Error('Não foi possível localizar o conteúdo do contrato.')

      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      setRenderData(null)

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
      setRenderData(null)
      setGenerating(false)
    }
  }

  async function handleSend() {
    if (!signerName.trim()) {
      toast.error('Informe o nome do cliente.')
      return
    }
    if (!signerEmail.trim() && !signerPhone.trim()) {
      toast.error('Informe e-mail ou telefone do cliente.')
      return
    }
    if (!signer2Name.trim()) {
      toast.error('Informe o nome do signatário da agência.')
      return
    }
    if (!signer2Email.trim() && !signer2Phone.trim()) {
      toast.error('Informe e-mail ou telefone do signatário da agência.')
      return
    }
    setSending(true)
    const res = await sendContractForSignature(
      orgSlug,
      saleId,
      {
        name: signerName.trim(),
        email: signerEmail.trim() || undefined,
        phone: signerPhone.trim() || undefined,
      },
      {
        name: signer2Name.trim(),
        email: signer2Email.trim() || undefined,
        phone: signer2Phone.trim() || undefined,
      },
    )
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

  function handleCopyLink() {
    if (!contract?.signature_link) return
    navigator.clipboard.writeText(contract.signature_link)
    toast.success('Link copiado.')
  }

  const status: string = contract?.status || 'draft'
  const meta = STATUS_META[status] || STATUS_META.draft
  const StatusIcon = meta.icon
  const hasPdf = !!contract?.pdf_path
  const isSent = status === 'sent'
  const isSigned = status === 'signed'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5" /> Gerenciar contrato
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            <div className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${meta.className}`}>
              <div className="flex items-center gap-2">
                <StatusIcon className="w-4 h-4 shrink-0" />
                <span className="font-medium">{meta.label}</span>
              </div>
              {contract?.sent_at && !isSigned && (
                <span className="text-xs opacity-80">
                  enviado em {new Date(contract.sent_at).toLocaleDateString('pt-BR')}
                </span>
              )}
              {contract?.signed_at && isSigned && (
                <span className="text-xs opacity-80">
                  assinado em {new Date(contract.signed_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>

            {/* 1. Documento */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Documento
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleGenerate} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSignature className="w-4 h-4 mr-1.5" />}
                  {hasPdf ? 'Gerar novamente' : 'Gerar contrato (PDF)'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleView('pdf')} disabled={!hasPdf}>
                  <Eye className="w-4 h-4 mr-1.5" /> Visualizar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleView('signed')} disabled={!isSigned}>
                  <Download className="w-4 h-4 mr-1.5" /> Baixar assinado
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/app/${orgSlug}/reservas/${saleId}/contrato`} target="_blank">
                    <Settings2 className="w-4 h-4 mr-1.5" /> Editar modelo
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* 2. Assinatura */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="w-4 h-4" /> Assinatura digital (Autentique)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isSigned ? (
                  <p className="text-sm text-muted-foreground">
                    Este contrato já foi assinado por <strong>{contract.signer_name}</strong> e{' '}
                    <strong>{contract.signer2_name}</strong>.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Cliente (contratante)</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Nome</Label>
                          <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Nome completo" disabled={isSent} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">E-mail</Label>
                          <Input value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder="email@exemplo.com" disabled={isSent} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Telefone (WhatsApp)</Label>
                          <Input value={signerPhone} onChange={e => setSignerPhone(e.target.value)} placeholder="5511999999999" disabled={isSent} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground pt-2">Agência (contratada)</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Nome do responsável</Label>
                          <Input value={signer2Name} onChange={e => setSigner2Name(e.target.value)} placeholder="Nome completo" disabled={isSent} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">E-mail</Label>
                          <Input value={signer2Email} onChange={e => setSigner2Email(e.target.value)} placeholder="email@exemplo.com" disabled={isSent} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Telefone (WhatsApp)</Label>
                          <Input value={signer2Phone} onChange={e => setSigner2Phone(e.target.value)} placeholder="5511999999999" disabled={isSent} />
                        </div>
                      </div>
                    </div>

                    {!isSent ? (
                      <Button size="sm" onClick={handleSend} disabled={sending || !hasPdf} className="w-full sm:w-auto">
                        {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                        Enviar para assinatura
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
                        {refreshing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                        Atualizar status de assinatura
                      </Button>
                    )}
                    {!hasPdf && !isSent && (
                      <p className="text-xs text-muted-foreground">Gere o PDF do contrato antes de enviar para assinatura.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* 3. Atalhos de envio do link */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Atalhos — reenviar link de assinatura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={emailTo}
                    onChange={e => setEmailTo(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="text-xs"
                    disabled={!contract?.signature_link}
                  />
                  <Button size="sm" variant="outline" onClick={handleSendEmail} disabled={!contract?.signature_link} title="Enviar por e-mail">
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopyLink} disabled={!contract?.signature_link} title="Copiar link">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {contract?.signature_link
                    ? 'Para enviar por WhatsApp, use o botão de atalho na conversa do cliente em Conversas.'
                    : 'Disponível depois que o contrato for enviado para assinatura.'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>

      {/* Render fora da tela usado só pra capturar o snapshot do PDF — não
          fica visível, e some assim que a captura termina. */}
      <div ref={captureRef} style={{ position: 'fixed', left: -10000, top: 0, width: 900, pointerEvents: 'none' }} aria-hidden>
        {renderData?.ok && (
          renderData.hasTemplate ? (
            <ContractTemplatePrintView
              saleId={saleId}
              orgSlug={orgSlug}
              bodyHtml={renderData.bodyHtml}
              org={renderData.org}
            />
          ) : (
            <ContractPrintView sale={renderData.sale} org={renderData.org} orgSlug={orgSlug} />
          )
        )}
      </div>
    </Dialog>
  )
}
