'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MessageCircle, Loader2, CheckCircle2, Unplug } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getWhatsappEmbeddedSignupUrl, disconnectWhatsapp } from '@/actions/whatsapp'

/**
 * Embedded Signup por redirecionamento — o clique busca a URL assinada no
 * servidor e navega a própria aba pra lá (não é popup). A Meta redireciona
 * de volta pro nosso callback (/api/whatsapp/embedded-signup/callback) depois
 * de completar, que já deixa tudo conectado antes do usuário voltar pra tela.
 */
export default function WhatsappEmbeddedSignup({
  orgSlug,
  alreadyConnected,
}: {
  orgSlug: string
  alreadyConnected: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleConnect() {
    setLoading(true)
    const res = await getWhatsappEmbeddedSignupUrl(orgSlug)
    if (!res.ok) {
      setLoading(false)
      toast.error(res.error)
      return
    }
    window.location.href = res.url
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    const res = await disconnectWhatsapp(orgSlug)
    setDisconnecting(false)
    if (res.ok) {
      toast.success('WhatsApp desconectado.')
      window.location.reload()
    } else {
      toast.error(res.error || 'Não foi possível desconectar.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleConnect} disabled={loading} size="lg" className="w-full sm:w-auto">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Redirecionando...
            </>
          ) : alreadyConnected ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Trocar número
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4 mr-2" />
              Conectar WhatsApp
            </>
          )}
        </Button>

        {alreadyConnected && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="lg" disabled={disconnecting} className="w-full sm:w-auto">
                {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unplug className="w-4 h-4 mr-2" />}
                Desconectar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
                <AlertDialogDescription>
                  O número atual vai parar de enviar e receber mensagens pelo CRM, e{' '}
                  <strong>todo o histórico de conversas deste número será apagado</strong> — essa
                  parte não pode ser desfeita. Você pode conectar outro número em seguida, a
                  qualquer momento.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>Desconectar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {alreadyConnected
          ? 'Pra trocar de número, conecte outro pelo Facebook — ele substitui o atual automaticamente.'
          : 'Você será direcionado ao Facebook para autorizar e escolher o número. Sem copiar tokens ou IDs.'}
      </p>
    </div>
  )
}
