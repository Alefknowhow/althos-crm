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

// Precisa bater com a versão que o painel da Meta documenta pra essa
// Configuration (App → WhatsApp → Configurador de cadastro incorporado) —
// uma versão desatualizada do SDK pode não honrar response_type:'code' nem
// disparar o postMessage de finalização do Embedded Signup corretamente.
const GRAPH_VERSION = 'v26.0'

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
  const [disconnecting, setDisconnecting] = useState(false)
  // session info (phone_number_id / waba_id) arrives via postMessage, before
  // the FB.login callback hands us the `code`.
  const sessionInfo = useRef<{ phoneNumberId?: string; wabaId?: string }>({})

  // Log visível na própria tela — depender do console do navegador se
  // mostrou pouco confiável pra diagnosticar (mensagens cortadas/perdidas ao
  // copiar). Cada linha aqui também vai pro console, com o mesmo prefixo.
  const [debugLog, setDebugLog] = useState<string[]>([])
  const log = (msg: string) => {
    const line = `${new Date().toLocaleTimeString('pt-BR')} — ${msg}`
    console.log('[WhatsApp Embedded Signup]', msg)
    setDebugLog(prev => [...prev, line].slice(-20))
  }

  // Load the Facebook JS SDK once.
  useEffect(() => {
    if (window.FB) {
      log('SDK já estava carregado.')
      setSdkReady(true)
      return
    }
    log('Carregando SDK do Facebook...')
    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: GRAPH_VERSION,
      })
      log(`SDK pronto (versão ${GRAPH_VERSION}).`)
      setSdkReady(true)
    }
    const id = 'facebook-jssdk'
    if (!document.getElementById(id)) {
      const js = document.createElement('script')
      js.id = id
      js.src = 'https://connect.facebook.net/en_US/sdk.js'
      js.async = true
      js.defer = true
      js.onerror = () => log('ERRO: falha ao carregar o script do SDK do Facebook (bloqueado por adblock/rede?).')
      document.body.appendChild(js)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId])

  // Capture the WhatsApp Embedded Signup session info (phone/waba ids).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // O popup pode ter iframes internos em subdomínios diferentes
      // (business.facebook.com, m.facebook.com etc.) — aceita qualquer
      // subdomínio de facebook.com em vez de só www/web, que pode estar
      // sendo a causa do postMessage de finalização nunca chegar.
      if (!/^https:\/\/([a-z0-9-]+\.)*facebook\.com$/.test(event.origin)) {
        if (typeof event.data === 'string' && event.data.length < 500) {
          log(`postMessage ignorado (origem ${event.origin}): ${event.data}`)
        }
        return
      }
      try {
        const data = JSON.parse(event.data)
        if (data.type !== 'WA_EMBEDDED_SIGNUP') {
          log(`postMessage de facebook.com mas tipo diferente: ${data.type}`)
          return
        }
        // Loga todo evento do popup — sem isso, quando a Meta não manda
        // FINISH (ex.: usuário cancelou, deu erro de verificação, ou o
        // fluxo devolveu um evento diferente do esperado) a UI fica em
        // silêncio total sem nenhuma pista do que aconteceu.
        log(`postMessage recebido: ${data.event} — ${JSON.stringify(data.data)}`)
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
        log('ERRO: recebi o code mas não tinha phoneNumberId/wabaId (postMessage FINISH não chegou antes do callback).')
        toast.error('Não recebemos os dados do número. Tente novamente.')
        return
      }
      log('Enviando code pro servidor pra trocar por access token...')
      const res = await connectWhatsappEmbedded(orgSlug, { code, phoneNumberId, wabaId })
      log(res.ok ? 'Conectado com sucesso.' : `ERRO do servidor: ${res.error}`)
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
      log('Cliquei em conectar, mas o SDK ainda não estava pronto.')
      toast.error('Carregando o conector... tente novamente em instantes.')
      return
    }
    setWorking(true)
    sessionInfo.current = {}
    log('Abrindo popup de login do Facebook...')
    // FB.login precisa ser chamado direto e de forma síncrona dentro do
    // clique — um getLoginStatus/logout assíncrono antes dele tira o popup
    // do contexto de "gesto do usuário" e o navegador bloqueia silenciosamente.
    // auth_type:'reauthenticate' foi tentado pra evitar sessão em cache, mas
    // piorou (not_authorized quase instantâneo mesmo completando o fluxo) —
    // removido, volta ao formato exato documentado pelo painel da Meta.
    window.FB.login(
      (response: any) => {
        log(`FB.login respondeu — status: ${response?.status}, tem code: ${!!response?.authResponse?.code}, tem accessToken: ${!!response?.authResponse?.accessToken}`)
        const code = response?.authResponse?.code
        if (code) {
          finish(code)
        } else {
          setWorking(false)
          if (response?.status === 'unknown' || !response?.authResponse) {
            toast.error('Não foi possível concluir a conexão. Verifique se o pop-up não foi bloqueado e tente de novo.')
          } else {
            toast.error('O Facebook não devolveu o código esperado. Veja o log de diagnóstico abaixo.')
          }
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        // Formato exato do link de "testar configuração" gerado pelo próprio
        // painel da Meta pra esse config_id (dialog/oauth?...&extras=...) —
        // usa "features" (array), não "featureType" (string) como tentamos
        // antes.
        extras: {
          sessionInfoVersion: '3',
          version: 'v4',
          features: [{ name: 'app_only_install' }],
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

      {debugLog.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Log de diagnóstico da conexão</p>
            <button
              type="button"
              onClick={() => setDebugLog([])}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              limpar
            </button>
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-muted-foreground max-h-48 overflow-y-auto space-y-0.5">
            {debugLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
