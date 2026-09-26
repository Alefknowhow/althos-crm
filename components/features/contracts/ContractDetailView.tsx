'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Send, RefreshCw, XCircle, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import TiptapEmailEditor from '@/components/features/email/TiptapEmailEditor'
import { updateContractDraft, cancelContract } from '@/actions/contracts-global'
import { getContractSaleContext } from '@/actions/contracts-origin'
import { sendContractForSignature, refreshContractStatus, deleteContract } from '@/actions/contracts-global-signature'
import ContractSignersPanel from './ContractSignersPanel'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', ready: 'Pronto para envio', sent: 'Enviado', viewed: 'Visualizado',
  awaiting_signature: 'Aguardando assinatura', signed: 'Assinado', rejected: 'Recusado',
  expired: 'Expirado', cancelled: 'Cancelado',
}

const EVENT_LABEL: Record<string, string> = {
  'contract.created': 'Contrato criado',
  'contract.generated': 'Documento gerado',
  'contract.sent': 'Enviado para assinatura',
  'contract.viewed': 'Visualizado pelo signatário',
  'contract.signed': 'Assinado',
  'contract.rejected': 'Recusado pelo signatário',
  'contract.cancelled': 'Cancelado',
  'contract.autentique_cancel_failed': 'Falha ao cancelar na Autentique (cancelado localmente)',
}

export default function ContractDetailView({ orgSlug, contract }: { orgSlug: string; contract: any }) {
  const router = useRouter()
  const [editingBody, setEditingBody] = useState(false)
  const [bodyDraft, setBodyDraft] = useState(contract.body_html || '')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saleContext, setSaleContext] = useState<Awaited<ReturnType<typeof getContractSaleContext>> | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contract.related_entity_type === 'venda' && contract.related_entity_id) {
      getContractSaleContext(orgSlug, contract.related_entity_id).then(setSaleContext)
    }
  }, [orgSlug, contract.related_entity_type, contract.related_entity_id])

  const editable = contract.status === 'draft'
  const statusAllowsSend = contract.status === 'draft' || contract.status === 'ready'
  const hasSigners = (contract.contract_signers?.length || 0) > 0
  const hasBody = !!contract.body_html
  const canSend = statusAllowsSend && hasSigners && hasBody && !editingBody
  const sendBlockedReason = !statusAllowsSend
    ? null // já enviado/assinado/cancelado — nada a fazer aqui
    : !hasBody ? 'Escolha um modelo ou edite o conteúdo do contrato antes de enviar.'
    : !hasSigners ? 'Adicione pelo menos 1 signatário abaixo antes de enviar.'
    : null
  const canCheck = !!contract.autentique_document_id && contract.status !== 'signed' && contract.status !== 'cancelled'
  // Excluir só se nunca chegou a sair do rascunho local (nunca enviado à
  // Autentique); depois de enviado, o caminho é cancelar. Assinado é
  // registro legal — nem uma coisa nem outra (decisão do usuário, #60 B.5).
  const canDelete = (contract.status === 'draft' || contract.status === 'ready') && !contract.autentique_document_id
  const canCancel = !canDelete && contract.status !== 'signed' && contract.status !== 'cancelled'

  function reload() {
    router.refresh()
  }

  async function saveBody() {
    setSaving(true)
    const res = await updateContractDraft(orgSlug, contract.id, { bodyHtml: bodyDraft })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setEditingBody(false)
    toast.success('Conteúdo salvo')
    reload()
  }

  async function handleCancel() {
    const res = await cancelContract(orgSlug, contract.id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Contrato cancelado')
    reload()
  }

  async function handleDelete() {
    if (!confirm('Excluir este contrato? Essa ação não pode ser desfeita.')) return
    setDeleting(true)
    const res = await deleteContract(orgSlug, contract.id)
    setDeleting(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Contrato excluído')
    router.push(`/app/${orgSlug}/contratos`)
  }

  /** Converte o body_html renderizado num PDF (html2canvas + jsPDF — mesmo
   *  mecanismo já usado pelo ContratoManagerDialog de Reservas) e envia
   *  direto pra assinatura via Autentique. */
  async function handleGenerateAndSend() {
    const target = captureRef.current
    if (!target) return
    setSending(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
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

      const res = await sendContractForSignature(orgSlug, contract.id, base64)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Contrato enviado para assinatura')
      reload()
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar o PDF do contrato.')
    } finally {
      setSending(false)
    }
  }

  async function handleCheckStatus() {
    setChecking(true)
    const res = await refreshContractStatus(orgSlug, contract.id)
    setChecking(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(res.signed ? 'Contrato assinado!' : 'Ainda aguardando assinatura.')
    reload()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{contract.title}</h1>
          <p className="text-xs text-muted-foreground">
            {saleContext
              ? `Venda: ${saleContext.contatoName}${saleContext.productName ? ` · ${saleContext.productName}` : ''}`
              : contract.related_entity_type ? `Origem: ${contract.related_entity_type}` : 'Sem vínculo'}
          </p>
        </div>
        <Badge>{STATUS_LABEL[contract.status] || contract.status}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusAllowsSend && (
          <Button type="button" size="sm" onClick={handleGenerateAndSend} disabled={sending || !canSend} title={sendBlockedReason || undefined}>
            {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            Gerar e enviar para assinatura
          </Button>
        )}
        {statusAllowsSend && sendBlockedReason && (
          <p className="text-xs text-muted-foreground basis-full">{sendBlockedReason}</p>
        )}
        {canCheck && (
          <Button type="button" size="sm" variant="outline" onClick={handleCheckStatus} disabled={checking}>
            {checking ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Verificar status
          </Button>
        )}
        {canCancel && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleCancel}>
            <XCircle className="w-4 h-4 mr-1.5" /> Cancelar contrato
          </Button>
        )}
        {canDelete && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
            Excluir contrato
          </Button>
        )}
      </div>

      <ContractSignersPanel
        orgSlug={orgSlug}
        contractId={contract.id}
        signers={contract.contract_signers || []}
        editable={editable}
        onChange={reload}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento</p>
          {editable && !editingBody && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingBody(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar conteúdo
            </Button>
          )}
        </div>
        <div className="rounded-lg border p-4 max-h-96 overflow-y-auto bg-white">
          {contract.body_html ? (
            <div ref={captureRef} className="max-w-[210mm] bg-white text-sm" dangerouslySetInnerHTML={{ __html: contract.body_html }} />
          ) : (
            <p className="text-xs text-muted-foreground">Sem conteúdo — escolha um modelo ou edite o conteúdo manualmente.</p>
          )}
        </div>
      </div>

      {editingBody && (
        <Dialog open onOpenChange={o => { if (!o) { setEditingBody(false); setBodyDraft(contract.body_html || '') } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Editar conteúdo do contrato</DialogTitle></DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <TiptapEmailEditor orgSlug={orgSlug} value={bodyDraft} onChange={setBodyDraft} placeholder="Escreva o contrato…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditingBody(false); setBodyDraft(contract.body_html || '') }} disabled={saving}>Cancelar</Button>
              <Button type="button" onClick={saveBody} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</p>
        <div className="space-y-1.5">
          {(contract.events || []).map((e: any) => (
            <div key={e.id} className={cn('flex items-center gap-2 text-xs')}>
              <span className="text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString('pt-BR')}</span>
              <span>{EVENT_LABEL[e.type] || e.type}</span>
            </div>
          ))}
          {(!contract.events || contract.events.length === 0) && (
            <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
