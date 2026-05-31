'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteSocialConnection, type SocialConnection } from '@/actions/social-automations'
import { toast } from 'sonner'
import { AtSign, Plus, Trash2, Check, Copy, AlertTriangle, ExternalLink } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'A integração ainda não foi configurada no servidor (faltam as credenciais do App Meta).',
  no_instagram: 'Nenhuma conta do Instagram profissional vinculada às suas Páginas do Facebook foi encontrada.',
  oauth: 'Você cancelou ou negou a autorização no Facebook.',
  missing_code: 'O Facebook não retornou o código de autorização. Tente novamente.',
  org_not_found: 'Organização não encontrada.',
  exchange: 'Falha ao trocar o código por um token de acesso.',
  invalid_state: 'Sessão de conexão expirada. Tente novamente.',
}

export default function SocialConnectClient({
  orgSlug,
  connections,
  configured,
  webhookUrl,
  flash,
}: {
  orgSlug: string
  connections: SocialConnection[]
  configured: boolean
  webhookUrl: string
  flash: { connected?: string; error?: string; msg?: string }
}) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Surface the OAuth round-trip result once, then clean the URL.
  useEffect(() => {
    if (flash.connected) {
      toast.success('Instagram conectado com sucesso!')
      router.replace(`/app/${orgSlug}/configuracoes/social`)
    } else if (flash.error) {
      toast.error(ERROR_MESSAGES[flash.error] || flash.msg || 'Erro ao conectar')
      router.replace(`/app/${orgSlug}/configuracoes/social`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash.connected, flash.error])

  function handleConnect() {
    window.location.href = `/api/social/instagram/connect?org=${encodeURIComponent(orgSlug)}`
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSocialConnection(orgSlug, id)
        toast.success('Conta desconectada')
        router.refresh()
      } catch (e: any) {
        toast.error(e.message || 'Erro ao desconectar')
      } finally {
        setDeleteId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Connected accounts */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Contas conectadas</h2>
          <Button size="sm" onClick={handleConnect}>
            <Plus className="w-4 h-4 mr-1.5" /> Conectar Instagram
          </Button>
        </div>

        {connections.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8 px-4 rounded-lg border border-dashed">
            <div
              className="w-12 h-12 rounded-xl grid place-items-center text-white mb-3"
              style={{ background: 'linear-gradient(135deg, #f09433, #dc2743 50%, #bc1888)' }}
            >
              <AtSign className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium">Nenhuma conta conectada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Conecte uma conta profissional do Instagram (Business/Creator) vinculada a uma Página do Facebook.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map(conn => (
              <div key={conn.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div
                  className="w-9 h-9 rounded-lg grid place-items-center text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #f09433, #dc2743 50%, #bc1888)' }}
                >
                  <AtSign className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conn.username ? `@${conn.username}` : conn.page_name || 'Conta Instagram'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{conn.page_name}</p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                  <Check className="w-3 h-3 mr-1" /> Ativo
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setDeleteId(conn.id)}
                  disabled={pending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server-not-configured warning */}
      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Integração ainda não configurada no servidor</p>
            <p className="mt-1 text-amber-700">
              As variáveis <code className="text-xs bg-amber-100 px-1 rounded">META_APP_ID</code> e{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">META_APP_SECRET</code> precisam ser definidas
              no ambiente (Vercel) para o botão de conexão funcionar. Veja o passo a passo abaixo.
            </p>
          </div>
        </div>
      )}

      {/* Setup guide */}
      <SetupGuide webhookUrl={webhookUrl} />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar conta?</AlertDialogTitle>
            <AlertDialogDescription>
              As automações pararão de responder por esta conta. Você pode reconectar a qualquer momento.
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

function SetupGuide({ webhookUrl }: { webhookUrl: string }) {
  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: '1. Conta Instagram Profissional',
      body: (
        <>Transforme seu Instagram em conta <b>Profissional</b> (Business ou Creator) e vincule-a a uma{' '}
        <b>Página do Facebook</b>. Isso é feito no app do Instagram: Configurações → Conta → Mudar para conta profissional.</>
      ),
    },
    {
      title: '2. Crie um App no Meta for Developers',
      body: (
        <>Acesse{' '}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
            developers.facebook.com/apps <ExternalLink className="w-3 h-3" />
          </a>{' '}
          → <b>Criar App</b> → tipo <b>Empresa (Business)</b>. Dentro do App, adicione os produtos{' '}
          <b>Login do Facebook</b> e <b>Instagram</b> (API de Mensagens do Instagram).</>
      ),
    },
    {
      title: '3. Configure o redirecionamento OAuth',
      body: (
        <>Em <b>Login do Facebook → Configurações</b>, adicione esta URL em “URIs de redirecionamento OAuth válidos”:
          <CopyRow value={`${webhookUrl.replace('/api/webhooks/instagram', '')}/api/social/instagram/callback`} onCopy={copy} /></>
      ),
    },
    {
      title: '4. Configure o Webhook',
      body: (
        <>Em <b>Webhooks → Instagram</b>, use a URL de callback e o token de verificação:
          <CopyRow label="Callback URL" value={webhookUrl} onCopy={copy} />
          <CopyRow label="Verify token" value="(o valor de META_WEBHOOK_VERIFY_TOKEN do seu ambiente)" onCopy={copy} />
          <span className="block mt-2">Inscreva os campos: <b>messages</b>, <b>comments</b>, <b>mentions</b>.</span></>
      ),
    },
    {
      title: '5. Permissões (App Review)',
      body: (
        <>Solicite a aprovação destas permissões avançadas no <b>App Review</b>:
          <code className="block mt-1 text-xs bg-muted rounded p-2 leading-relaxed">
            instagram_basic · instagram_manage_messages · instagram_manage_comments ·
            pages_show_list · pages_manage_metadata · pages_read_engagement · business_management
          </code>
          <span className="block mt-1 text-xs">Em modo de desenvolvimento você já pode testar com contas de teste/admins antes da aprovação.</span></>
      ),
    },
    {
      title: '6. Defina as variáveis de ambiente',
      body: (
        <>No painel da Vercel (Settings → Environment Variables), defina:
          <code className="block mt-1 text-xs bg-muted rounded p-2 leading-relaxed">
            META_APP_ID = (App ID do seu App Meta)<br />
            META_APP_SECRET = (App Secret){'  '}<br />
            META_WEBHOOK_VERIFY_TOKEN = (uma frase aleatória que você define)
          </code>
          <span className="block mt-1 text-xs">Faça um novo deploy após salvar. Depois é só clicar em “Conectar Instagram”.</span></>
      ),
    },
  ]

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold mb-1">Como conectar — passo a passo</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Conectar o Instagram para automação de DMs/comentários usa OAuth + App Review do Meta — não é uma “chave” única.
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

function CopyRow({ label, value, onCopy }: { label?: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      {label && <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0 w-24">{label}</span>}
      <code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate">{value}</code>
      <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={() => onCopy(value)}>
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
