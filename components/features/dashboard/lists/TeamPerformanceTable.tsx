import type { SellerPerf } from '@/actions/dashboard-v2-team'
import { deriveInitials } from '@/lib/organization/initials'
import { fmtCurrency0, fmtDays, fmtPct } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

/** Tabela visual de performance dos vendedores (não é gráfico): meta com mini barra de progresso. */
export default function TeamPerformanceTable({ rows, selectedId }: { rows: SellerPerf[]; selectedId: string | null }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma atividade de vendedores no período.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="text-left font-medium py-2 pr-3">Vendedor</th>
            <th className="text-right font-medium py-2 px-3">Receita</th>
            <th className="text-right font-medium py-2 px-3">Vendas</th>
            <th className="text-right font-medium py-2 px-3">Conversão</th>
            <th className="text-right font-medium py-2 px-3">Ticket</th>
            <th className="text-left font-medium py-2 px-3 w-[180px]">Meta do mês</th>
            <th className="text-right font-medium py-2 pl-3">Ciclo</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(r => {
            const pct = r.goal_pct
            return (
              <tr key={r.seller_id} className={cn('hover:bg-muted/40 transition-colors', selectedId === r.seller_id && 'bg-primary/5')}>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-semibold bg-primary/12 text-primary shrink-0">{deriveInitials(r.name)}</span>
                    <span className="font-medium truncate">{r.name}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{fmtCurrency0(r.revenue_cents)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{r.sales_count}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{fmtPct(r.conversion_pct)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{fmtCurrency0(r.ticket_cents)}</td>
                <td className="py-2.5 px-3">
                  {pct === null ? (
                    <span className="text-xs text-muted-foreground">Sem meta</span>
                  ) : (
                    <span className="flex items-center gap-2" title={`${fmtCurrency0(r.month_revenue_cents)} de ${fmtCurrency0(r.goal_cents)}${r.goal_is_individual ? '' : ' (meta da empresa ÷ vendedores)'}`}>
                      <span className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-success' : pct >= 70 ? 'bg-primary' : 'bg-warning')} style={{ width: `${Math.min(100, pct)}%` }} />
                      </span>
                      <span className={cn('text-xs tabular-nums w-10 text-right', pct >= 100 && 'text-success font-semibold')}>{fmtPct(pct)}</span>
                    </span>
                  )}
                </td>
                <td className="py-2.5 pl-3 text-right tabular-nums">{r.avg_cycle_days !== null ? fmtDays(r.avg_cycle_days) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
