'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, MessageCircle } from 'lucide-react'
import { getWhatsappConnectionStatus } from '@/actions/whatsapp'
import WhatsappEmbeddedSignup from '@/components/features/WhatsappEmbeddedSignup'

type Status = Awaited<ReturnType<typeof getWhatsappConnectionStatus>>

/**
 * "Conectar WhatsApp" fora da tela de Configurações (ex.: menu de
 * Conversas) — todo o processo de login acontece dentro deste pop-up
 * (WhatsappEmbeddedSignup já abre o popup de login do Facebook e recebe o
 * resultado via postMessage, sem navegar a página principal pra lugar
 * nenhum). A tela de Configurações → WhatsApp continua existindo, com o
 * mesmo componente.
 */
export default function ConnectWhatsappDialog({
  orgSlug, open, onOpenChange,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getWhatsappConnectionStatus(orgSlug).then(res => { setStatus(res); setLoading(false) })
  }, [open, orgSlug])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-success" />
            Conectar WhatsApp
          </DialogTitle>
        </DialogHeader>

        {loading || !status ? (
          <div className="py-10 grid place-items-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : status.embeddedConfigured ? (
          <WhatsappEmbeddedSignup
            orgSlug={orgSlug}
            appId={status.appId!}
            configId={status.configId!}
            alreadyConnected={status.alreadyConnected}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            A conexão pelo Facebook não está configurada neste ambiente. Fale com o suporte para liberar essa integração na sua conta.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
