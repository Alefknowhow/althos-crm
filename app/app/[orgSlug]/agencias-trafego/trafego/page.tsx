import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { isTrafficNiche } from '@/lib/niche'
import EmptyState from '@/components/ui/empty-state'
import { Megaphone } from 'lucide-react'
import TrafegoCommandCenter, { type ClientCardData } from '@/components/features/agencias-trafego/TrafegoCommandCenter'
import { computeClientHealthStatus } from '@/lib/trafego/health-status'

export const dynamic = 'force-dynamic'

/**
 * Tela principal da vertical Tráfego — "Traffic Command Center". Carrega só
 * o resumo por cliente (não a performance detalhada — isso fica pra quando
 * o gestor abre o cliente, ver trafego/[id]/page.tsx). Uma passada em lote
 * (contas → campanhas → métricas de 60d) em vez de 1 query por cliente.
 */
export default async function AgenciaTrafegoTrafegoPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) {
    const { redirect } = await import('next/navigation')
    redirect(`/app/${params.orgSlug}`)
  }

  const supabase = createClient()
  const now = new Date()
  const since60d = new Date(now.getTime() - 59 * 86_400_000)
  const since30d = new Date(now.getTime() - 29 * 86_400_000)
  const boundary30dStr = since30d.toISOString().slice(0, 10)

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
  const [{ data: accounts }, { data: creativesPending }, { data: sales30d }] = await Promise.all([
    supabase.from('ad_accounts').select('id, contato_id, provider, updated_at, created_at').eq('organization_id', org.id).in('contato_id', clientIds),
    supabase.from('campaign_creatives').select('id, contato_id, status').eq('organization_id', org.id).in('contato_id', clientIds).eq('status', 'pendente'),
    supabase.from('sales').select('contato_id, amount_cents').eq('organization_id', org.id).in('contato_id', clientIds).eq('status', 'completed').gte('sale_date', boundary30dStr),
  ])

  const accountIdsByClient = new Map<string, string[]>()
  const platformByClient = new Map<string, string>()
  const lastSyncByClient = new Map<string, string>()
  for (const a of accounts || []) {
    if (!a.contato_id) continue
    const arr = accountIdsByClient.get(a.contato_id) || []
    arr.push(a.id)
    accountIdsByClient.set(a.contato_id, arr)
    if (!platformByClient.has(a.contato_id)) platformByClient.set(a.contato_id, a.provider)
    const ts = a.updated_at || a.created_at
    const prevTs = lastSyncByClient.get(a.contato_id)
    if (ts && (!prevTs || ts > prevTs)) lastSyncByClient.set(a.contato_id, ts)
  }
  const allAccountIds = (accounts || []).map(a => a.id)

  const campaignsByAccount = new Map<string, { id: string; status: string }[]>()
  const metricsByCampaign = new Map<string, { current: { spend: number; leads: number }; previous: { spend: number; leads: number } }>()
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
        .select('campaign_id, date, spend_cents, meta_leads')
        .eq('organization_id', org.id)
        .in('campaign_id', campaignIds)
        .gte('date', since60d.toISOString().slice(0, 10))
      for (const m of metrics || []) {
        const bucket = m.date >= boundary30dStr ? 'current' : 'previous'
        const cur = metricsByCampaign.get(m.campaign_id) || { current: { spend: 0, leads: 0 }, previous: { spend: 0, leads: 0 } }
        cur[bucket].spend += m.spend_cents || 0
        cur[bucket].leads += (m as any).meta_leads || 0
        metricsByCampaign.set(m.campaign_id, cur)
      }
    }
  }

  const pendingByClient = new Map<string, number>()
  for (const cr of creativesPending || []) {
    pendingByClient.set(cr.contato_id, (pendingByClient.get(cr.contato_id) || 0) + 1)
  }
  const revenueByClient = new Map<string, number>()
  for (const s of sales30d || []) {
    revenueByClient.set(s.contato_id, (revenueByClient.get(s.contato_id) || 0) + (s.amount_cents || 0))
  }

  const cards: ClientCardData[] = clients.map(client => {
    const accountIds = accountIdsByClient.get(client.id) || []
    const campaignRows = accountIds.flatMap(id => campaignsByAccount.get(id) || [])
    const activeCampaigns = campaignRows.filter(c => c.status === 'active').length

    let spend = 0, prevSpend = 0, leads = 0, prevLeads = 0
    for (const c of campaignRows) {
      const m = metricsByCampaign.get(c.id)
      if (!m) continue
      spend += m.current.spend; prevSpend += m.previous.spend
      leads += m.current.leads; prevLeads += m.previous.leads
    }
    const revenue = revenueByClient.get(client.id) || 0
    const cplCents = leads > 0 ? spend / leads : null
    const roas = spend > 0 ? revenue / spend : null
    const profile = (client.traffic_client_profile as any) || null

    const health = computeClientHealthStatus({
      investmentCents: spend,
      cplCents,
      targetCpl: profile?.targetCpl ?? null,
      roas,
      targetRoas: profile?.targetRoas ?? null,
    })

    const lastSyncIso = lastSyncByClient.get(client.id) || null
    const lastSyncDaysAgo = lastSyncIso ? Math.floor((now.getTime() - new Date(lastSyncIso).getTime()) / 86_400_000) : null

    return {
      id: client.id,
      name: client.name,
      niche: profile?.niche || null,
      platform: platformByClient.get(client.id) || null,
      health,
      investmentCents: spend,
      prevInvestmentCents: prevSpend,
      leads,
      prevLeads,
      cplCents,
      roas,
      activeCampaigns,
      pendingCreatives: pendingByClient.get(client.id) || 0,
      lastSyncDaysAgo,
    }
  })

  return (
    <div className="p-4 sm:p-6">
      <TrafegoCommandCenter orgSlug={params.orgSlug} clients={cards} />
    </div>
  )
}
