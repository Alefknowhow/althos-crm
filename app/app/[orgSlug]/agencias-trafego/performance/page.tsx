import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'
import { getTrafegoPerformance } from '@/actions/trafego-performance'
import KpiCard from '@/components/features/dashboard/KpiCard'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Vertical Agências de Tráfego — Etapa 2, Fase H. Performance real (vendas
 * dos últimos 30 dias, por cliente e por origem) — ROAS/CAC ficam como
 * estado "—" explicado, mesma disciplina da aba Tráfego do Dashboard
 * (Fase C): sem investimento em mídia rastreado, não dá pra calcular sem
 * inventar número.
 */
export default async function AgenciaTrafegoPerformancePage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const { byClient, bySource } = await getTrafegoPerformance(params.orgSlug)
  const totalRevenue = byClient.reduce((a, c) => a + c.revenueCents, 0)
  const totalSales = byClient.reduce((a, c) => a + c.salesCount, 0)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Últimos 30 dias.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Receita 30d" value={formatCurrency(totalRevenue)} help="Soma das vendas concluídas nos últimos 30 dias." />
        <KpiCard label="Vendas 30d" value={String(totalSales)} help="Quantidade de vendas concluídas nos últimos 30 dias." />
        <KpiCard
          label="ROAS"
          value="—"
          help="Depende do módulo Tráfego (investimento em mídia por conta de anúncio), ainda não conectado a este cálculo."
        />
        <KpiCard
          label="CAC"
          value="—"
          help="Custo de aquisição por cliente — depende de investimento em mídia, sem fonte de dado hoje."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Top clientes por receita</h2>
          {byClient.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda concluída nos últimos 30 dias.</p>
          ) : (
            <div className="space-y-2">
              {byClient.map(c => (
                <div key={c.contatoId} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.salesCount} venda{c.salesCount !== 1 ? 's' : ''}{c.source ? ` · ${c.source}` : ''}</div>
                  </div>
                  <div className="tabular-nums font-medium shrink-0 ml-3">{formatCurrency(c.revenueCents)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Receita por origem</h2>
          {bySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda concluída nos últimos 30 dias.</p>
          ) : (
            <div className="space-y-2">
              {bySource.map(s => (
                <div key={s.source} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{s.source}</div>
                    <div className="text-xs text-muted-foreground">{s.salesCount} venda{s.salesCount !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="tabular-nums font-medium">{formatCurrency(s.revenueCents)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
