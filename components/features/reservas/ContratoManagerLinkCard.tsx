'use client'

/**
 * "Resend signature link" shortcuts card for ContratoManagerDialog. Split
 * out of ContratoManagerDialog.tsx.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Copy } from 'lucide-react'

export function ContratoManagerLinkCard({
  emailTo, setEmailTo, hasSignatureLink, onSendEmail, onCopyLink,
}: {
  emailTo: string
  setEmailTo: (v: string) => void
  hasSignatureLink: boolean
  onSendEmail: () => void
  onCopyLink: () => void
}) {
  return (
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
            disabled={!hasSignatureLink}
          />
          <Button size="sm" variant="outline" onClick={onSendEmail} disabled={!hasSignatureLink} title="Enviar por e-mail">
            <Mail className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onCopyLink} disabled={!hasSignatureLink} title="Copiar link">
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {hasSignatureLink
            ? 'Para enviar por WhatsApp, use o botão de atalho na conversa do cliente em Conversas.'
            : 'Disponível depois que o contrato for enviado para assinatura.'}
        </p>
      </CardContent>
    </Card>
  )
}
