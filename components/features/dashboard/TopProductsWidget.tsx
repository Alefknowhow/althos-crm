import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'
import { getTopProducts } from '@/actions/dashboard-tabs'
import { COMPACT_CARD_H, LIST_SCROLL_H } from './dashboardSizes'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function TopProductsWidget({ orgId, since }: { orgId: string; since: Date }) {
  const rows = await getTopProducts(orgId, since)
  // Barra ranqueia por comissão (dado principal); nichos sem comissão (fora
  // de viagens, sempre 0) caem pra receita total como critério.
  const hasCommission = rows.some(r => r.commission_cents > 0)
  const isDestination = rows.some(r => r.type === 'Destino')
  const barValue = (r: (typeof rows)[number]) => hasCommission ? r.commission_cents : r.total_cents
  const maxValue = Math.max(1, ...rows.map(barValue))

  return (
    <Card className={`${COMPACT_CARD_H} flex flex-col`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-600" />
          {isDestination ? 'Destinos mais vendidos' : 'Mais vendidos'}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {isDestination
            ? (hasCommission ? 'Destinos com mais comissão gerada no período.' : 'Destinos com mais receita no período.')
            : (hasCommission ? 'Produtos/serviços com mais comissão gerada no período.' : 'Produtos/serviços com mais receita no período.')}
        </p>
      </CardHeader>
      <CardContent className={`${LIST_SCROLL_H} overflow-y-auto shrink-0`}>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {isDestination ? 'Nenhuma venda com destino preenchido no período.' : 'Nenhuma venda com produto associado no período.'}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.product_id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{r.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                    {hasCommission
                      ? <>{fmtCurrency(r.commission_cents)} <span className="opacity-70">· {fmtCurrency(r.total_cents)}</span></>
                      : fmtCurrency(r.total_cents)}
                  </span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500/70"
                    style={{ width: `${(barValue(r) / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
