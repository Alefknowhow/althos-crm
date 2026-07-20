'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  deleteGoogleBusinessConnection, syncGoogleBusinessLocations, toggleGoogleBusinessLocationLink,
  type GoogleBusinessConnection, type GoogleBusinessLocation,
} from '@/actions/google-business'
import { toast } from 'sonner'
import { MapPin, Plus, Trash2, Check, Copy, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'A integração ainda não foi configurada no servidor (faltam as credenciais do Google Cloud).',
  no_account: 'Nenhuma conta do Google Business Profile foi encontrada para o usuário que autorizou.',
  oauth: 'Você cancelou ou negou a autorização no Google.',
  missing_code: 'O Google não retornou o código de autorização. Tente novamente.',
  org_not_found: 'Organização não encontrada.',
  exchange: 'Falha ao trocar o código por um token de acesso.',
  invalid_state: 'Sessão de conexão expirada. Tente novamente.',
}

export default function GoogleBusinessConnectClient({
  orgSlug, connections, locationsByConnection, configured, redirectUri, flash,
}: {
  orgSlug: string
  connections: GoogleBusinessConnection[]
  locationsByConnection: Record<string, GoogleBusinessLocation[]>
  configured: boolean
  redirectUri: string
  flash: { connected?: string; error?: string; msg?: string }
}) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (flash.connected) {
      toast.success('Google Business conectado! Sincronize as unidades abaixo.')
      router.replace(`/app/${orgSlug}/configuracoes/google-business`)
    } else if (flash.error) {
      toast.error(ERROR_MESSAGES[flash.error] || flash.msg || 'Erro ao conectar')
      router.replace(`/app/${orgSlug}/configuracoes/google-business`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash.connected, flash.error])

  function handleConnect() {
    window.location.href = `/api/google-business/connect?org=${encodeURIComponent(orgSlug)}`
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteGoogleBusinessConnection(orgSlug, id)
      if (res.ok) { toast.success('Conta desconectada'); router.refresh() }
      else toast.error(res.error)
      setDeleteId(null)
    })
  }

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId)
    const res = await syncGoogleBusinessLocations(orgSlug, connectionId)
    setSyncingId(null)
    if (res.ok) { toast.success(`${res.count} unidade(s) sincronizada(s)`); router.refresh() }
    else toast.error(res.error)
  }

  async function handleToggleLocation(locationId: string, linked: boolean) {
    const res = await toggleGoogleBusinessLocationLink(orgSlug, locationId, linked)
    if (res.ok) router.refresh()
    else toast.error(res.error)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-none border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Contas conectadas</h2>
          <Button size="sm" onClick={handleConnect}>
            <Plus className="w-4 h-4 mr-1.5" /> Conectar Google Business
          </Button>
        </div>

        {connections.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8 px-4 rounded-lg border border-dashed">
            <div className="w-12 h-12 rounded-none grid place-items-center bg-blue-50 text-blue-600 mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium">Nenhuma conta conectada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Conecte a conta Google que administra o Perfil da Empresa da sua agência.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => {
              const locations = locationsByConnection[conn.id] || []
              return (
                <div key={conn.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg grid place-items-center bg-blue-50 text-blue-600 shrink-0">
                      <MapPin className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conn.account_name || conn.google_account_id}</p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                      <Check className="w-3 h-3 mr-1" /> Ativo
                    </Badge>
                    <Button
                      variant="ghost" size="icon" className="w-8 h-8 shrink-0"
                      disabled={syncingId === conn.id}
                      onClick={() => handleSync(conn.id)}
                      title="Sincronizar unidades"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingId === conn.id ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setDeleteId(conn.id)} disabled={pending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {locations.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-12">
                      Nenhuma unidade sincronizada ainda — clique no ícone de sincronizar acima.
                    </p>
                  ) : (
                    <div className="pl-12 space-y-1.5">
                      {locations.map(loc => (
                        <div key={loc.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{loc.title || loc.google_location_id}</p>
                            {loc.address && <p className="text-xs text-muted-foreground truncate">{loc.address}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">Vinculada</span>
                            <Switch checked={loc.is_linked} onCheckedChange={v => handleToggleLocation(loc.id, v)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!configured && (
        <div className="rounded-none border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Integração ainda não configurada no servidor</p>
            <p className="mt-1 text-amber-700">
              As variáveis <code className="text-xs bg-amber-100 px-1 rounded">GOOGLE_BUSINESS_CLIENT_ID</code> e{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">GOOGLE_BUSINESS_CLIENT_SECRET</code> precisam ser
              definidas no ambiente (Vercel) para o botão de conexão funcionar. Veja o passo a passo abaixo.
            </p>
          </div>
        </div>
      )}

      <SetupGuide redirectUri={redirectUri} />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar conta?</AlertDialogTitle>
            <AlertDialogDescription>
              As unidades vinculadas param de sincronizar. Você pode reconectar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleDelete(deleteId!)}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SetupGuide({ redirectUri }: { redirectUri: string }) {
  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: '1. Ficha verificada no Google',
      body: <>Confirme que o Perfil da Empresa da agência já está verificado em{' '}
        <a href="https://business.google.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
          business.google.com <ExternalLink className="w-3 h-3" />
        </a>. Sem verificação a API não retorna nada.</>,
    },
    {
      title: '2. Crie/abra um projeto no Google Cloud',
      body: <>Acesse{' '}
        <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
          console.cloud.google.com <ExternalLink className="w-3 h-3" />
        </a>{' '}e crie (ou reaproveite) um projeto.</>,
    },
    {
      title: '3. Solicite acesso à Business Profile API',
      body: <>Diferente da maioria das APIs do Google, essa <b>não libera na hora</b> — é preciso preencher o{' '}
        <a href="https://developers.google.com/my-business/content/prereqs" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
          formulário de acesso <ExternalLink className="w-3 h-3" />
        </a>{' '}e esperar aprovação (pode levar dias/semanas). Peça isso o quanto antes — é o item que trava o resto.</>,
    },
    {
      title: '4. Configure a tela de consentimento OAuth',
      body: <>Em <b>APIs e serviços → Tela de consentimento OAuth</b>, adicione o escopo{' '}
        <code className="text-xs bg-muted px-1 rounded">business.manage</code>.</>,
    },
    {
      title: '5. Crie um Client ID OAuth',
      body: <>Em <b>APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth</b>, tipo{' '}
        <b>Aplicativo da Web</b>, com esta URI de redirecionamento autorizada:
        <CopyRow value={redirectUri} onCopy={copy} /></>,
    },
    {
      title: '6. Defina as variáveis de ambiente',
      body: <>No painel da Vercel (Settings → Environment Variables):
        <code className="block mt-1 text-xs bg-muted rounded p-2 leading-relaxed">
          GOOGLE_BUSINESS_CLIENT_ID = (Client ID do OAuth)<br />
          GOOGLE_BUSINESS_CLIENT_SECRET = (Client secret do OAuth)
        </code>
        <span className="block mt-1 text-xs">Faça um novo deploy após salvar. Depois é só clicar em "Conectar Google Business".</span></>,
    },
  ]

  return (
    <div className="rounded-none border bg-card p-5">
      <h2 className="text-sm font-semibold mb-1">Como conectar — passo a passo</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Conectar o Google Business usa OAuth + aprovação de API do Google — não é uma "chave" única.
      </p>
      <ol className="space-y-4">
        {steps.map(s => (
          <li key={s.title} className="text-sm">
            <p className="font-medium text-foreground">{s.title}</p>
            <div className="text-muted-foreground mt-1 leading-relaxed">{s.body}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function CopyRow({ value, onCopy }: { value: string; onCopy: (v: string) => void }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate">{value}</code>
      <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={() => onCopy(value)}>
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
