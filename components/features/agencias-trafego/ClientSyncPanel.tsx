'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, Wifi, WifiOff, Link2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { syncAdAccountCampaigns } from '@/actions/marketing'
import type { ClientPerformanceSummary } from '@/actions/trafego-performance'
import type { MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import AssignMetaAdAccountPanel from './AssignMetaAdAccountPanel'

type AdAccount = { id: string; provider: string; name: string; external_id: string | null; status: string; updated_at?: string; created_at?: string }

const PROVIDER_LABEL: Record<string, string> = { meta: 'Meta Ads', google: 'Google Ads', tiktok: 'TikTok Ads', other: 'Outra plataforma' }

function syncLabel(a: AdAccount): string {
  const ts = a.updated_at || a.created_at
  if (!ts) return 'Nunca sincronizado'
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000)
  if (days === 0) return 'Sincronizado hoje'
  if (days === 1) return 'Sincronizado há 1 dia'
  return `Sincronizado há ${days} dias`
}

/**
 * Aba Performance — dashboard da(s) conta(s) de anúncio do cliente.
 * IMPORTANTE: só mostra/sincroniza contas já vinculadas a ESTE cliente
 * (accounts vem filtrado por ad_accounts.contato_id — ver
 * actions/marketing.ts::listAdAccountsByClient) — nunca "todas as contas
 * do workspace". Layout da tabela abaixo é a mesma linguagem visual da
 * aba Campanhas (ClientCampaignsTable) — componente próprio, não reaproveitado.
 */
export default function ClientSyncPanel({
  orgSlug, clientId, accounts, performance, orgMetaConnected, assignableOptions, assignedElsewhere,
}: {
  orgSlug: string
  clientId: string
  accounts: AdAccount[]
  performance: ClientPerformanceSummary
  orgMetaConnected: boolean
  assignableOptions: MetaAdAccountOption[]
  assignedElsewhere: string[]
}) {
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
    // A agência conecta o Facebook uma vez só (Business Manager com acesso
    // às contas de todos os clientes) — se já tem token, só falta escolher
    // qual conta é deste cliente, sem pedir login de novo.
    if (orgMetaConnected) {
      return (
        <Card>
          <CardHeader><CardTitle className="text-base">Conta de anúncios</CardTitle></CardHeader>
          <CardContent>
            <AssignMetaAdAccountPanel
              orgSlug={orgSlug}
              clientId={clientId}
              options={assignableOptions}
              assignedElsewhere={assignedElsewhere}
            />
          </CardContent>
        </Card>
      )
    }
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">A agência ainda não conectou uma conta do Facebook.</p>
          <Button asChild size="sm">
            <a href={`/api/meta-ads/connect?orgSlug=${orgSlug}&clientId=${clientId}`}>
              <Link2 className="w-4 h-4 mr-1.5" /> Conectar com Facebook
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Conecte uma vez com o Business Manager da agência — depois é só escolher a conta de cada cliente aqui, sem logar de novo.
            Ou cadastre uma conta manualmente logo abaixo (outras plataformas).
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Conta de anúncios</CardTitle>
        {!accounts.some(a => a.provider === 'meta') && (
          <Button asChild size="sm" variant="outline">
            <a href={`/api/meta-ads/connect?orgSlug=${orgSlug}&clientId=${clientId}`}>
              <Link2 className="w-4 h-4 mr-1.5" /> Conectar Meta Ads
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">Conta</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Última sincronização</th>
                <th className="py-2 pl-0 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map(a => {
                const connected = a.provider === 'meta' && !!a.external_id
                return (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{PROVIDER_LABEL[a.provider] || a.provider} · {a.external_id || 'sem ID'}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant="outline" className={connected ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}>
                        {connected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                        {connected ? 'Conectada' : 'Não conectada'}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">{syncLabel(a)}</td>
                    <td className="py-2.5 pl-0 text-right">
                      <Button size="sm" variant="outline" onClick={() => handleSync(a.id)} disabled={syncingId === a.id || a.provider !== 'meta'}>
                        {syncingId === a.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                        Sincronizar agora
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Resumo agregado (30d) — mesmos números da Visão Geral, aqui no contexto da conta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Investimento (30d)</div>
            <div className="font-semibold tabular-nums">{formatCurrency(performance.investmentCents)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Impressões</div>
            <div className="font-semibold tabular-nums">{performance.impressions.toLocaleString('pt-BR')}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliques</div>
            <div className="font-semibold tabular-nums">{performance.clicks.toLocaleString('pt-BR')}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CTR</div>
            <div className="font-semibold tabular-nums">{performance.ctr != null ? `${(performance.ctr * 100).toFixed(2)}%` : '—'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
