'use client'

/**
 * Signature-collection card (client + agency signer fields, send/refresh
 * actions) for ContratoManagerDialog. Split out of ContratoManagerDialog.tsx.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, RefreshCw } from 'lucide-react'

export function ContratoManagerSignatureCard({
  isSigned, contract, signerName, setSignerName, signerEmail, setSignerEmail, signerPhone, setSignerPhone,
  signer2Name, setSigner2Name, signer2Email, setSigner2Email, signer2Phone, setSigner2Phone,
  isSent, hasPdf, sending, refreshing, onSend, onRefresh,
}: {
  isSigned: boolean
  contract: any
  signerName: string
  setSignerName: (v: string) => void
  signerEmail: string
  setSignerEmail: (v: string) => void
  signerPhone: string
  setSignerPhone: (v: string) => void
  signer2Name: string
  setSigner2Name: (v: string) => void
  signer2Email: string
  setSigner2Email: (v: string) => void
  signer2Phone: string
  setSigner2Phone: (v: string) => void
  isSent: boolean
  hasPdf: boolean
  sending: boolean
  refreshing: boolean
  onSend: () => void
  onRefresh: () => void
}) {
  return (
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
              <Button size="sm" onClick={onSend} disabled={sending || !hasPdf} className="w-full sm:w-auto">
                {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                Enviar para assinatura
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
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
  )
}
