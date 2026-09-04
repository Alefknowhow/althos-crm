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
import { Loader2, FileSignature, CheckCircle2, FileText, Clock, XCircle } from 'lucide-react'
import {
  getPlanSaleContract,
  uploadPlanContractPdf,
  sendPlanContractForSignature,
  refreshPlanContractStatus,
  getPlanContractFileUrl,
  sendPlanContractLinkByEmail,
  getPlanContractRenderData,
  getPlanContractEditableBody,
  savePlanContractBody,
} from '@/actions/plan-contracts'
import PlanContractPrintView from '@/components/features/agencias-trafego/PlanContractPrintView'
import { PlanoContratoSignatureCard } from '@/components/features/agencias-trafego/PlanoContratoSignatureCard'
import { PlanoContratoLinkCard } from '@/components/features/agencias-trafego/PlanoContratoLinkCard'
import { PlanoContratoBodyCard } from '@/components/features/agencias-trafego/PlanoContratoBodyCard'
import { PlanoContratoDocumentCard } from '@/components/features/agencias-trafego/PlanoContratoDocumentCard'

type Props = {
  orgSlug: string
  saleId: string
  clientName: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  draft:    { label: 'Rascunho',              className: 'bg-muted text-muted-foreground',                                   icon: FileText },
  sent:     { label: 'Aguardando assinatura', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',       icon: Clock },
  signed:   { label: 'Assinado',              className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Recusado',              className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',              icon: XCircle },
}

/**
 * Gestão de contrato de assinatura de plano (Agências de Tráfego) — mesmo
 * fluxo/UI de ContratoManagerDialog (Reservas), mas usando
 * actions/plan-contracts.ts + tabela plan_contracts própria, não
 * compartilhada com sale_contracts (Reservas/Viagens).
 */
export default function PlanoContratoManagerDialog({ orgSlug, saleId, clientName, clientEmail, clientPhone, open, onOpenChange }: Props) {
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [signerName, setSignerName] = useState(clientName || '')
  const [signerEmail, setSignerEmail] = useState(clientEmail || '')
  const [signerPhone, setSignerPhone] = useState(clientPhone || '')
  const [signer2Name, setSigner2Name] = useState('')
  const [signer2Email, setSigner2Email] = useState('')
  const [signer2Phone, setSigner2Phone] = useState('')
  const [emailTo, setEmailTo] = useState(clientEmail || '')
  const [renderData, setRenderData] = useState<any>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  // Conteúdo deste contrato específico (cláusulas podem mudar de cliente pra
  // cliente) — carregado sob demanda quando o operador abre o editor, não no
  // open do diálogo (evita custo se ninguém for editar).
  const [editingBody, setEditingBody] = useState(false)
  const [bodyLoading, setBodyLoading] = useState(false)
  const [bodyHtml, setBodyHtml] = useState('')
  const [savingBody, setSavingBody] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getPlanSaleContract(orgSlug, saleId).then(c => {
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
    const c = await getPlanSaleContract(orgSlug, saleId)
    setContract(c)
  }

  async function openBodyEditor() {
    setEditingBody(true)
    setBodyLoading(true)
    const res = await getPlanContractEditableBody(orgSlug, saleId)
    setBodyLoading(false)
    if (!res.ok) { toast.error((res as any).error || 'Erro ao carregar o conteúdo'); setEditingBody(false); return }
    setBodyHtml(res.bodyHtml)
  }

  async function handleSaveBody() {
    setSavingBody(true)
    const res = await savePlanContractBody(orgSlug, saleId, bodyHtml)
    setSavingBody(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Conteúdo do contrato salvo — a próxima geração de PDF já usa esse texto.')
    setEditingBody(false)
    await reload()
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const data = await getPlanContractRenderData(orgSlug, saleId)
      if (!data.ok) throw new Error(data.error)

      flushSync(() => setRenderData(data))
      await new Promise(resolve => setTimeout(resolve, 500))

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
      const res = await uploadPlanContractPdf(orgSlug, saleId, base64)
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
    const res = await sendPlanContractForSignature(
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
    const res = await refreshPlanContractStatus(orgSlug, saleId)
    setRefreshing(false)
    if (!res.ok) {
      toast.error(res.error)
    } else {
      toast.success(res.status === 'signed' ? 'Contrato assinado!' : 'Ainda aguardando assinatura.')
      await reload()
    }
  }

  async function handleView(which: 'pdf' | 'signed') {
    const res = await getPlanContractFileUrl(orgSlug, saleId, which)
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
    const res = await sendPlanContractLinkByEmail(orgSlug, saleId, emailTo.trim())
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

            <PlanoContratoDocumentCard
              orgSlug={orgSlug}
              saleId={saleId}
              generating={generating}
              hasPdf={hasPdf}
              isSigned={isSigned}
              onGenerate={handleGenerate}
              onView={handleView}
            />

            <PlanoContratoBodyCard
              orgSlug={orgSlug}
              isSent={isSent}
              isSigned={isSigned}
              editingBody={editingBody}
              bodyLoading={bodyLoading}
              bodyHtml={bodyHtml}
              setBodyHtml={setBodyHtml}
              savingBody={savingBody}
              onOpenEditor={openBodyEditor}
              onSave={handleSaveBody}
              onCancel={() => setEditingBody(false)}
            />

            <PlanoContratoSignatureCard
              isSigned={isSigned}
              contract={contract}
              signerName={signerName} setSignerName={setSignerName}
              signerEmail={signerEmail} setSignerEmail={setSignerEmail}
              signerPhone={signerPhone} setSignerPhone={setSignerPhone}
              signer2Name={signer2Name} setSigner2Name={setSigner2Name}
              signer2Email={signer2Email} setSigner2Email={setSigner2Email}
              signer2Phone={signer2Phone} setSigner2Phone={setSigner2Phone}
              isSent={isSent}
              hasPdf={hasPdf}
              sending={sending}
              refreshing={refreshing}
              onSend={handleSend}
              onRefresh={handleRefresh}
            />

            <PlanoContratoLinkCard
              emailTo={emailTo}
              setEmailTo={setEmailTo}
              hasSignatureLink={!!contract?.signature_link}
              onSendEmail={handleSendEmail}
              onCopyLink={handleCopyLink}
            />
          </div>
        )}
      </DialogContent>

      <div ref={captureRef} style={{ position: 'fixed', left: -10000, top: 0, width: 900, pointerEvents: 'none' }} aria-hidden>
        {renderData?.ok && (
          <PlanContractPrintView sale={renderData.sale} org={renderData.org} bodyHtml={renderData.hasTemplate ? renderData.bodyHtml : undefined} />
        )}
      </div>
    </Dialog>
  )
}
