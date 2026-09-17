'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AtSign, Loader2 } from 'lucide-react'

/**
 * "Conectar Instagram" fora da tela de Configurações (ex.: menu de
 * Conversas) — o login com o Facebook abre numa janela pop-up de verdade
 * (window.open) em vez de navegar a página inteira pra lá; a página
 * principal só observa a janela fechar e atualiza. A tela de
 * Configurações → Social continua existindo, com o mesmo fluxo por trás.
 */
export default function ConnectInstagramDialog({
  orgSlug, open, onOpenChange,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  function handleConnect() {
    const width = 600
    const height = 720
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    const popup = window.open(
      `/api/social/instagram/connect?org=${encodeURIComponent(orgSlug)}`,
      'althos-instagram-connect',
      `width=${width},height=${height},left=${left},top=${top}`,
    )
    if (!popup) return
    popupRef.current = popup
    setConnecting(true)
    pollRef.current = setInterval(() => {
      if (popup.closed) {
        if (pollRef.current) clearInterval(pollRef.current)
        setConnecting(false)
        router.refresh()
        onOpenChange(false)
      }
    }, 600)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AtSign className="w-4 h-4" style={{ color: '#dc2743' }} />
            Conectar Instagram
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Conecte uma conta profissional do Instagram (Business/Creator) vinculada a uma Página do Facebook —
          uma janela do Facebook abre pra você autorizar e escolher a conta.
        </p>

        <Button onClick={handleConnect} disabled={connecting} className="w-full">
          {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AtSign className="w-4 h-4 mr-2" />}
          {connecting ? 'Aguardando a janela do Facebook...' : 'Conectar Instagram'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
