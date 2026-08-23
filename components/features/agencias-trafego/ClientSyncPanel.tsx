'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, Wifi, WifiOff } from 'lucide-react'
import { syncAdAccountCampaigns } from '@/actions/marketing'

type AdAccount = { id: string; provider: string; name: string; external_id: string | null; status: string }

const PROVIDER_LABEL: Record<string, string> = { meta: 'Meta Ads', google: 'Google Ads', tiktok: 'TikTok Ads', other: 'Outra plataforma' }

/**
 * Aba Performance — dashboard da(s) conta(s) de anúncio do cliente.
 * IMPORTANTE: só mostra/sincroniza contas já vinculadas a ESTE cliente
 * (accounts vem filtrado por ad_accounts.contato_id — ver
 * actions/marketing.ts::listAdAccountsByClient) — nunca "todas as contas
 * do workspace".
 */
export default function ClientSyncPanel({ orgSlug, accounts }: { orgSlug: string; accounts: AdAccount[] }) {
  const router = useRouter()
  const [syncingId, setSyncingId] = useState<string | null>(null)

  async function handleSync(id: string) {
    setSyncingId(id)
    const res = await syncAdAccountCampaigns(orgSlug, id)
    setSyncingId(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Sincronizado com sucesso')
    router.refresh()
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Conta ainda não conectada. Vincule uma conta de anúncio a este cliente na aba Campanhas.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {accounts.map(a => {
        const connected = a.provider === 'meta' && !!a.external_id
        return (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">{PROVIDER_LABEL[a.provider] || a.provider}</CardTitle>
              <Badge variant="outline" className={connected ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}>
                {connected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                {connected ? 'Conectada' : 'Não conectada'}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.external_id || 'Sem ID de conta configurado'}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleSync(a.id)} disabled={syncingId === a.id || a.provider !== 'meta'}>
                {syncingId === a.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Sincronizar agora
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
