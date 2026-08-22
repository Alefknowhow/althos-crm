import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { isTrafficNiche } from '@/lib/niche'
import EmptyState from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Vertical Agências de Tráfego — lista de clientes gerenciados (contatos com
 * status='cliente'), com resumo de campanhas ativas, gasto (30d) e criativos
 * pendentes. Clicar abre o painel dedicado do cliente (Dados/Histórico/
 * Criativos) — camada separada de Contatos, que continua genérico.
 */
export default async function AgenciaTrafegoTrafegoPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const supabase = createClient()
  const since30d = new Date()
  since30d.setDate(since30d.getDate() - 30)

  const { data: clients } = await supabase
    .from('contatos')
    .select('id, name, traffic_client_profile')
    .eq('organization_id', org.id)
    .eq('status', 'cliente')
    .order('name', { ascending: true })

  if (!clients || clients.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={Megaphone}
          title="Nenhum cliente ainda"
          description="Marque um contato como cliente para começar a gerenciar campanhas de tráfego pago para ele."
        />
      </div>
    )
  }

  const clientIds = clients.map(c => c.id)
  const [{ data: accounts }, { data: creatives }] = await Promise.all([
    supabase.from('ad_accounts').select('id, contato_id').eq('organization_id', org.id).in('contato_id', clientIds),
    supabase.from('campaign_creatives').select('id, contato_id, status').eq('organization_id', org.id).in('contato_id', clientIds).eq('status', 'pendente'),
  ])

  const accountIdsByClient = new Map<string, string[]>()
  for (const a of accounts || []) {
    if (!a.contato_id) continue
    const arr = accountIdsByClient.get(a.contato_id) || []
    arr.push(a.id)
    accountIdsByClient.set(a.contato_id, arr)
  }
  const allAccountIds = (accounts || []).map(a => a.id)

  let campaignsByAccount = new Map<string, { id: string; status: string }[]>()
  let spendByCampaign = new Map<string, number>()
  if (allAccountIds.length > 0) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, ad_account_id, status')
      .eq('organization_id', org.id)
      .in('ad_account_id', allAccountIds)
    for (const c of campaigns || []) {
      const arr = campaignsByAccount.get(c.ad_account_id) || []
      arr.push({ id: c.id, status: c.status })
      campaignsByAccount.set(c.ad_account_id, arr)
    }
    const campaignIds = (campaigns || []).map(c => c.id)
    if (campaignIds.length > 0) {
      const { data: metrics } = await supabase
        .from('campaign_metrics_daily')
        .select('campaign_id, spend_cents')
        .eq('organization_id', org.id)
        .in('campaign_id', campaignIds)
        .gte('date', since30d.toISOString().slice(0, 10))
      for (const m of metrics || []) {
        spendByCampaign.set(m.campaign_id, (spendByCampaign.get(m.campaign_id) || 0) + (m.spend_cents || 0))
      }
    }
  }

  const pendingByClient = new Map<string, number>()
  for (const cr of creatives || []) {
    pendingByClient.set(cr.contato_id, (pendingByClient.get(cr.contato_id) || 0) + 1)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clients.map(client => {
          const accountIds = accountIdsByClient.get(client.id) || []
          const campaignRows = accountIds.flatMap(id => campaignsByAccount.get(id) || [])
          const activeCampaigns = campaignRows.filter(c => c.status === 'active').length
          const spend = campaignRows.reduce((a, c) => a + (spendByCampaign.get(c.id) || 0), 0)
          const pending = pendingByClient.get(client.id) || 0
          const niche = client.traffic_client_profile?.niche

          return (
            <Link
              key={client.id}
              href={`/app/${params.orgSlug}/agencias-trafego/trafego/${client.id}`}
              className="block bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <div className="font-medium truncate">{client.name}</div>
              {niche && <div className="text-xs text-muted-foreground mt-0.5">{niche}</div>}
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campanhas ativas</span>
                  <span className="font-medium tabular-nums">{activeCampaigns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gasto (30d)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(spend)}</span>
                </div>
                {pending > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Criativos pendentes</span>
                    <span className="font-medium tabular-nums text-amber-600">{pending}</span>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
