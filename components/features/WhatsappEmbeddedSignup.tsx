'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { connectWhatsappEmbedded, disconnectWhatsapp } from '@/actions/whatsapp'

declare global {
  interface Window {
    FB?: any
    fbAsyncInit?: () => void
  }
}

const GRAPH_VERSION = 'v19.0'

/**
 * Embedded Signup button. The dono-de-clínica clicks "Conectar", logs into
 * Facebook in a popup, picks the number, and we receive a `code` + the
 * phone_number_id / waba_id (via postMessage). Everything technical is hidden.
 *
 * Renders nothing useful unless appId + configId are provided (env-gated by
 * the parent), so the page can fall back to the manual form.
 */
export default function WhatsappEmbeddedSignup({
  orgSlug,
  orgName,
  appId,
  configId,
  alreadyConnected,
}: {
  orgSlug: string
  orgName: string
  appId: string
  configId: string
  alreadyConnected: boolean
}) {
  const router = useRouter()
  const [sdkReady, setSdkReady] = useState(false)
  const [working, setWorking] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  // session info (phone_number_id / waba_id) arrives via postMessage, before
  // the FB.login callback hands us the `code`.
  const sessionInfo = useRef<{ phoneNumberId?: string; wabaId?: string }>({})

  // Load the Facebook JS SDK once.
  useEffect(() => {
    if (window.FB) {
      setSdkReady(true)
      return
    }
    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: GRAPH_VERSION,
      })
      setSdkReady(true)
    }
    const id = 'facebook-jssdk'
    if (!document.getElementById(id)) {
      const js = document.createElement('script')
      js.id = id
      js.src = 'https://connect.facebook.net/en_US/sdk.js'
      js.async = true
      js.defer = true
      document.body.appendChild(js)
    }
  }, [appId])

  // Capture the WhatsApp Embedded Signup session info (phone/waba ids).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      )
        return
      try {
        const data = JSON.parse(event.data)
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return
        // Loga todo evento do popup — sem isso, quando a Meta não manda
        // FINISH (ex.: usuário cancelou, deu erro de verificação, ou o
        // fluxo devolveu um evento diferente do esperado) a UI fica em
        // silêncio total sem nenhuma pista do que aconteceu.
        console.log('[WhatsApp Embedded Signup]', data.event, data.data)
        if (data.event === 'FINISH') {
          sessionInfo.current = {
            phoneNumberId: data.data?.phone_number_id,
            wabaId: data.data?.waba_id,
          }
        } else if (data.event === 'CANCEL') {
          setWorking(false)
          const step = data.data?.current_step
          toast.error(
            step
              ? `Conexão cancelada no passo "${step}". Verifique se o número já está confirmado no Meta Business Manager.`
              : 'Conexão cancelada.',
          )
        } else if (data.event === 'ERROR') {
          setWorking(false)
          toast.error(data.data?.error_message || 'A Meta retornou um erro durante a conexão.')
        }
      } catch {
        /* not a JSON message we care about */
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const finish = useCallback(
    async (code: string) => {
      const { phoneNumberId, wabaId } = sessionInfo.current
      if (!phoneNumberId || !wabaId) {
        setWorking(false)
        toast.error('Não recebemos os dados do número. Tente novamente.')
        return
      }
      const res = await connectWhatsappEmbedded(orgSlug, { code, phoneNumberId, wabaId })
      setWorking(false)
      if (res.ok) {
        toast.success(
          res.displayPhone
            ? `WhatsApp ${res.displayPhone} conectado! ✅`
            : 'WhatsApp conectado com sucesso! ✅',
        )
        sessionInfo.current = {}
        router.refresh()
      } else {
        toast.error(res.error || 'Não foi possível conectar.')
      }
    },
    [orgSlug, router],
  )

  async function handleDisconnect() {
    setDisconnecting(true)
    const res = await disconnectWhatsapp(orgSlug)
    setDisconnecting(false)
    if (res.ok) {
      toast.success('WhatsApp desconectado.')
      router.refresh()
    } else {
      toast.error(res.error || 'Não foi possível desconectar.')
    }
  }

  function launch() {
    if (!sdkReady || !window.FB) {
      toast.error('Carregando o conector... tente novamente em instantes.')
      return
    }
    setWorking(true)
    sessionInfo.current = {}
    window.FB.login(
      (response: any) => {
        console.log('[WhatsApp Embedded Signup] FB.login response', response)
        const code = response?.authResponse?.code
        if (code) {
          finish(code)
        } else {
          setWorking(false)
          if (response?.status === 'unknown' || !response?.authResponse) {
            toast.error('Não foi possível concluir a conexão. Verifique se o pop-up não foi bloqueado e tente de novo.')
          }
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        // business_management é o que permite a Meta enumerar os Business
        // Portfolios/WABAs que a pessoa já administra e oferecê-los no
        // popup — sem isso, o fluxo tende a só oferecer "criar conta nova"
        // mesmo quando já existe uma WABA configurada manualmente.
        scope: 'business_management,whatsapp_business_management',
        extras: {
          sessionInfoVersion: '2',
          // Pré-preenche o nome do negócio pra ajudar a Meta a casar com o
          // Business Manager certo quando a conta participa de mais de um.
          setup: { business: { name: orgName } },
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={launch} disabled={working} size="lg" className="w-full sm:w-auto">
          {working ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Conectando...
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
