'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MessageCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { connectWhatsappEmbedded } from '@/actions/whatsapp'

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
  appId,
  configId,
  alreadyConnected,
}: {
  orgSlug: string
  appId: string
  configId: string
  alreadyConnected: boolean
}) {
  const router = useRouter()
  const [sdkReady, setSdkReady] = useState(false)
  const [working, setWorking] = useState(false)
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
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          sessionInfo.current = {
            phoneNumberId: data.data?.phone_number_id,
            wabaId: data.data?.waba_id,
          }
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

  function launch() {
    if (!sdkReady || !window.FB) {
      toast.error('Carregando o conector... tente novamente em instantes.')
      return
    }
    setWorking(true)
    sessionInfo.current = {}
    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code
        if (code) {
          finish(code)
        } else {
          // user closed the popup or denied
          setWorking(false)
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { sessionInfoVersion: '2' },
      },
    )
  }

  return (
    <div className="space-y-3">
      <Button onClick={launch} disabled={working} size="lg" className="w-full sm:w-auto">
        {working ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Conectando...
          </>
        ) : alreadyConnected ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Reconectar WhatsApp
          </>
        ) : (
          <>
            <MessageCircle className="w-4 h-4 mr-2" />
            Conectar WhatsApp
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Você será direcionado ao Facebook para autorizar e escolher o número.
        Sem copiar tokens ou IDs.
      </p>
    </div>
  )
}
