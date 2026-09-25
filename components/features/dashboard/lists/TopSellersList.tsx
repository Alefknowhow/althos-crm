import type { SellerPerf } from '@/actions/dashboard-v2-team'
import { deriveInitials } from '@/lib/organization/initials'
import { fmtCurrency0, fmtPct } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

/** Lista compacta dos 5 melhores vendedores por receita: avatar, receita, vendas, conversão, % da meta. */
export default function TopSellersList({ sellers }: { sellers: SellerPerf[] }) {
  if (sellers.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda atribuída a vendedores no período.</p>
  }
  return (
    <div className="text-xs">
      <div className="grid grid-cols-[1fr_88px_52px_56px_76px] gap-2 px-1 pb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Vendedor</span>
        <span className="text-right">Receita</span>
        <span className="text-right">Vendas</span>
        <span className="text-right">Conv.</span>
        <span className="text-right">Meta</span>
      </div>
      <ul className="divide-y">
        {sellers.slice(0, 5).map((s, i) => (
          <li key={s.seller_id} className="grid grid-cols-[1fr_88px_52px_56px_76px] gap-2 items-center py-2 px-1 hover:bg-muted/40 rounded">
            <span className="flex items-center gap-2 min-w-0">
              <span className={cn(
                'w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold shrink-0',
                i === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/12 text-primary',
              )}>
                {deriveInitials(s.name)}
              </span>
              <span className="font-medium truncate">{s.name}</span>
            </span>
            <span className="text-right font-semibold tabular-nums">{fmtCurrency0(s.revenue_cents)}</span>
            <span className="text-right tabular-nums">{s.sales_count}</span>
            <span className="text-right tabular-nums">{fmtPct(s.conversion_pct)}</span>
            <span className="text-right">
              <span className="tabular-nums">{fmtPct(s.goal_pct)}</span>
              {s.goal_pct !== null && (
                <span className="block h-1 mt-0.5 rounded-full bg-muted overflow-hidden">
                  <span className={cn('block h-full rounded-full', s.goal_pct >= 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.min(100, s.goal_pct)}%` }} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
