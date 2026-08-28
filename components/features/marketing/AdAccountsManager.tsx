'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react'
import { deleteAdAccount, disconnectMetaAdsLogin, syncAdAccountCampaigns } from '@/actions/marketing'
import NewAdAccountDialog from './NewAdAccountDialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Account = {
  id: string
  provider: string
  name: string
  external_id: string | null
  status: string
  notes: string | null
}

const PROVIDER_LABEL: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  other: 'Outro',
}

const PROVIDER_COLOR: Record<string, string> = {
  meta: 'bg-blue-100 text-blue-700 border-blue-200',
  google: 'bg-amber-100 text-amber-700 border-amber-200',
  tiktok: 'bg-pink-100 text-pink-700 border-pink-200',
  other: 'bg-muted text-muted-foreground',
}

export default function AdAccountsManager({
  orgSlug,
  initial,
  metaLoginConnected,
  metaLoginUserName,
}: {
  orgSlug: string
  initial: Account[]
  /** Se a org tem um login do Facebook (Meta Ads) ativo — controla o botão
   *  de desconectar login, separado de excluir uma conta específica. */
  metaLoginConnected: boolean
  /** Nome do usuário Facebook logado (via /me), pra mostrar "conectado como
   *  X" — null se o token expirou/foi revogado do lado da Meta. */
  metaLoginUserName?: string | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)
  const [campaignWarning, setCampaignWarning] = useState<{ account: Account; count: number } | null>(null)
  const [disconnectingLogin, setDisconnectingLogin] = useState(false)
  const [confirmDisconnectLogin, setConfirmDisconnectLogin] = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function remove(a: Account, force = false) {
    setBusy(a.id)
    const res = await deleteAdAccount(orgSlug, a.id, force)
    setBusy(null)
    if (res.ok) {
      toast.success('Conta removida')
      refresh()
      return
    }
    if (!force && 'campaignCount' in res && res.campaignCount) {
      // Não é erro de verdade — pede confirmação extra pra apagar campanha junto.
      setCampaignWarning({ account: a, count: res.campaignCount })
      return
    }
    toast.error(res.error)
  }

  async function disconnectLogin() {
    setDisconnectingLogin(true)
    const res = await disconnectMetaAdsLogin(orgSlug)
    setDisconnectingLogin(false)
    setConfirmDisconnectLogin(false)
    if (res.ok) {
      toast.success('Login do Facebook desconectado')
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  async function sync(a: Account) {
    setSyncing(a.id)
    const res = await syncAdAccountCampaigns(orgSlug, a.id)
    setSyncing(null)
    if (!res.ok) { toast.error(res.error); return }
    if (res.error) toast.warning(`Sincronizado com avisos: ${res.error}`)
    toast.success(`${res.campaignsSynced} campanha(s), ${res.metricsSynced} métrica(s) atualizadas`)
    refresh()
  }

  return (
    <div className="space-y-4">
      {metaLoginConnected && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {metaLoginUserName
                  ? <>Conectado como <span className="font-medium">{metaLoginUserName}</span> (Meta Ads)</>
                  : 'Login do Facebook conectado (Meta Ads)'}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDisconnectLogin(true)}
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Desconectar login
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <NewAdAccountDialog
          orgSlug={orgSlug}
          onDone={refresh}
          trigger={<Button>+ Nova conta</Button>}
        />
      </div>

      {initial.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada. Crie a primeira para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {initial.map(a => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <Badge className={PROVIDER_COLOR[a.provider]}>
                      {PROVIDER_LABEL[a.provider] || a.provider}
                    </Badge>
                  </div>
                  {a.external_id && (
                    <p className="text-xs text-muted-foreground font-mono">{a.external_id}</p>
                  )}
                  {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {a.provider === 'meta' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sync(a)}
                      disabled={syncing === a.id}
                      title="Puxar campanhas e métricas dos últimos 30 dias"
                    >
                      <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing === a.id ? 'animate-spin' : ''}`} />
                      Sincronizar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setAccountToDelete(a)}
                    disabled={busy === a.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!accountToDelete} onOpenChange={o => !o && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {accountToDelete ? `Excluir "${accountToDelete.name}"? ` : ''}Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { remove(accountToDelete!); setAccountToDelete(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!campaignWarning} onOpenChange={o => !o && setCampaignWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanhas sincronizadas junto?</AlertDialogTitle>
            <AlertDialogDescription>
              {campaignWarning
                ? `"${campaignWarning.account.name}" tem ${campaignWarning.count} campanha(s) sincronizada(s) no CRM. `
                : ''}
              Excluir a conta também apaga essas campanhas (e as métricas ligadas a elas) — isso não afeta nada na
              Meta, só o que foi trazido pro CRM. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { remove(campaignWarning!.account, true); setCampaignWarning(null) }}
            >
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDisconnectLogin} onOpenChange={setConfirmDisconnectLogin}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar login do Facebook?</AlertDialogTitle>
            <AlertDialogDescription>
              O CRM para de conseguir sincronizar campanhas até um novo login. As contas de anúncio já cadastradas
              continuam na lista (não são apagadas) — pra reconectar, use "+ Nova conta" e faça login de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={disconnectingLogin}
              onClick={disconnectLogin}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
