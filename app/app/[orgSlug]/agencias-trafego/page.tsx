import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { isTrafficNiche } from '@/lib/niche'
import { getTrafegoDashboardMetrics } from '@/actions/dashboard-trafego'
import KpiCard from '@/components/features/dashboard/KpiCard'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Vertical Agências de Tráfego — landing da seção no menu lateral.
 * Reaproveita getTrafegoDashboardMetrics (mesma fonte da aba Tráfego do
 * Dashboard geral) + um resumo orientado a ação: quantos criativos
 * aguardam aprovação agora e quais clientes tiveram mais gasto recente —
 * diferente da aba do Dashboard, que é uma foto do período filtrado.
 */
export default async function AgenciaTrafegoVisaoGeralPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const supabase = createClient()
  const since30d = new Date()
  since30d.setDate(since30d.getDate() - 30)

  const [metrics, { data: pendingCreatives }] = await Promise.all([
    getTrafegoDashboardMetrics(params.orgSlug),
    supabase
      .from('campaign_creatives')
      .select('id, title, contato_id, contatos(name)')
      .eq('organization_id', org.id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Top clientes por gasto (30d) — mesma lógica de agregação de trafego/page.tsx.
  const { data: clients } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('status', 'cliente')

  let topSpenders: { id: string; name: string; spend: number }[] = []
  if (clients && clients.length > 0) {
    const clientIds = clients.map(c => c.id)
    const { data: accounts } = await supabase
      .from('ad_accounts')
      .select('id, contato_id')
      .eq('organization_id', org.id)
      .in('contato_id', clientIds)

    if (accounts && accounts.length > 0) {
      const accountIds = accounts.map(a => a.id)
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, ad_account_id')
        .eq('organization_id', org.id)
        .in('ad_account_id', accountIds)

      const campaignToAccount = new Map((campaigns || []).map(c => [c.id, c.ad_account_id]))
      const accountToClient = new Map(accounts.map(a => [a.id, a.contato_id]))

      if (campaigns && campaigns.length > 0) {
        const { data: dailyMetrics } = await supabase
          .from('campaign_metrics_daily')
          .select('campaign_id, spend_cents')
          .eq('organization_id', org.id)
          .in('campaign_id', campaigns.map(c => c.id))
          .gte('date', since30d.toISOString().slice(0, 10))

        const spendByClient = new Map<string, number>()
        for (const m of dailyMetrics || []) {
          const accountId = campaignToAccount.get(m.campaign_id)
          const clientId = accountId ? accountToClient.get(accountId) : null
          if (!clientId) continue
          spendByClient.set(clientId, (spendByClient.get(clientId) || 0) + (m.spend_cents || 0))
        }

        const nameById = new Map(clients.map(c => [c.id, c.name]))
        topSpenders = Array.from(spendByClient.entries())
          .map(([id, spend]) => ({ id, name: nameById.get(id) || '—', spend }))
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 3)
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Receita 30d" value={formatCurrency(metrics.revenueCents)} help="Soma das vendas concluídas nos últimos 30 dias." />
        <KpiCard label="Vendas 30d" value={String(metrics.salesCount)} help="Quantidade de vendas concluídas nos últimos 30 dias." />
        <KpiCard label="Clientes ativos" value={String(metrics.activeClients)} help="Contatos marcados como cliente." />
        <KpiCard label="Novos clientes (30d)" value={String(metrics.newClients)} help="Viraram cliente nos últimos 30 dias." />
        <KpiCard label="Leads gerados (30d)" value={String(metrics.leadsGenerated)} help="Novos contatos criados nos últimos 30 dias." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              {(pendingCreatives || []).length > 0 && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              Criativos aguardando aprovação
            </h2>
          </div>
          {(pendingCreatives || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum criativo pendente no momento.</p>
          ) : (
            <div className="space-y-2">
              {(pendingCreatives as any[]).map(c => (
                <Link
                  key={c.id}
                  href={`/app/${params.orgSlug}/agencias-trafego/trafego/${c.contato_id}`}
                  className="flex items-center justify-between text-sm hover:text-primary"
                >
                  <span className="truncate">{c.title} — {c.contatos?.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Maior gasto (30d)</h2>
          {topSpenders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha com gasto registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {topSpenders.map(c => (
                <Link
                  key={c.id}
                  href={`/app/${params.orgSlug}/agencias-trafego/trafego/${c.id}`}
                  className="flex items-center justify-between text-sm hover:text-primary"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(c.spend)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/app/${params.orgSlug}/agencias-trafego/trafego`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        Ver todos os clientes <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
