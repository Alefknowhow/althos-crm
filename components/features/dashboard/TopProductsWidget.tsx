import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'
import { getTopProducts } from '@/actions/dashboard-tabs'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function TopProductsWidget({ orgId, since }: { orgId: string; since: Date }) {
  const rows = await getTopProducts(orgId, since)
  const maxQty = Math.max(1, ...rows.map(r => r.quantity))

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-600" />
          Mais vendidos
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Produtos/serviços com mais unidades vendidas no período.</p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma venda com produto associado no período.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.product_id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{r.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                    {r.quantity}x · {fmtCurrency(r.total_cents)}
                  </span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500/70"
                    style={{ width: `${(r.quantity / maxQty) * 100}%` }}
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
