import { ChevronRight } from 'lucide-react'
import type { CustomerRow } from '@/actions/dashboard-v2-customers'
import { fmtCurrency0 } from '@/lib/dashboard/format'
import RiskBadge from './RiskBadge'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '')
}

/**
 * Tabela compacta de clientes (VIP ou em risco). Linhas com hover/seta —
 * navegação para o contato fica para a fase 2 (sem href/onClick).
 */
export default function CustomerTable({
  rows,
  variant,
  nameById,
  itemLabel,
  countLabel,
  emptyText,
}: {
  rows: CustomerRow[]
  variant: 'vip' | 'risk'
  nameById: Record<string, string>
  itemLabel: string
  countLabel: string
  emptyText: string
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground text-left">
          <th className="font-medium py-1.5 pr-2">Cliente</th>
          <th className="font-medium py-1.5 px-2 text-right">LTV</th>
          {variant === 'vip' ? (
            <>
              <th className="font-medium py-1.5 px-2 text-right">{countLabel}</th>
              <th className="font-medium py-1.5 px-2">Última compra</th>
              <th className="font-medium py-1.5 px-2 hidden lg:table-cell">{itemLabel}</th>
            </>
          ) : (
            <>
              <th className="font-medium py-1.5 px-2 text-right">Sem compra</th>
              <th className="font-medium py-1.5 px-2">Últ. interação</th>
              <th className="font-medium py-1.5 px-2">Risco</th>
            </>
          )}
          <th className="font-medium py-1.5 px-2 hidden md:table-cell">{variant === 'vip' ? 'Vendedor' : 'Responsável'}</th>
          <th className="w-4" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map(r => {
          const person = variant === 'vip' ? r.seller_id : r.assigned_to
          return (
            <tr key={r.contato_id} className="group cursor-pointer hover:bg-muted/50 transition-colors">
              <td className="py-2 pr-2 font-medium max-w-[160px] truncate" title={r.name}>{r.name}</td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmtCurrency0(r.ltv_cents)}</td>
              {variant === 'vip' ? (
                <>
                  <td className="py-2 px-2 text-right tabular-nums">{r.purchases}</td>
                  <td className="py-2 px-2 whitespace-nowrap">{fmtDate(r.last_purchase)}</td>
                  <td className="py-2 px-2 hidden lg:table-cell max-w-[120px] truncate" title={r.last_item || ''}>{r.last_item || '—'}</td>
                </>
              ) : (
                <>
                  <td className="py-2 px-2 text-right tabular-nums">{r.days_since}d</td>
                  <td className="py-2 px-2 whitespace-nowrap">{fmtDate(r.last_interaction_at)}</td>
                  <td className="py-2 px-2">{r.risk && <RiskBadge risk={r.risk} />}</td>
                </>
              )}
              <td className="py-2 px-2 hidden md:table-cell max-w-[110px] truncate text-muted-foreground">{person ? nameById[person] || 'Usuário' : '—'}</td>
              <td className="py-2"><ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground" /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
