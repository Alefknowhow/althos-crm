'use client'

import { TableProperties } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { fmtCurrency, fmtPct } from '@/lib/dashboard/format'

export type MonthlyDetailRow = {
  label: string
  revenue_cents: number
  commission_cents: number | null
  sales_count: number
}

/** Botão "Ver detalhes" → modal com a tabela mês a mês (faturamento, vendas, comissão). */
export default function MonthlyDetailsDialog({ rows, hasCommission }: { rows: MonthlyDetailRow[]; hasCommission: boolean }) {
  const totalRev = rows.reduce((a, r) => a + r.revenue_cents, 0)
  const totalComm = rows.reduce((a, r) => a + (r.commission_cents || 0), 0)
  const totalSales = rows.reduce((a, r) => a + r.sales_count, 0)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <TableProperties className="w-3.5 h-3.5" />
          Ver detalhes
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Faturamento {hasCommission ? 'e comissão ' : ''}por mês</DialogTitle>
          <DialogDescription>Últimos 12 meses, vendas concluídas.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left font-medium py-2">Mês</th>
                <th className="text-right font-medium py-2">Vendas</th>
                <th className="text-right font-medium py-2">Faturamento</th>
                {hasCommission && <th className="text-right font-medium py-2">Comissão</th>}
                {hasCommission && <th className="text-right font-medium py-2">%</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.label}>
                  <td className="py-1.5">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.sales_count}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtCurrency(r.revenue_cents)}</td>
                  {hasCommission && <td className="py-1.5 text-right tabular-nums">{fmtCurrency(r.commission_cents)}</td>}
                  {hasCommission && <td className="py-1.5 text-right tabular-nums text-muted-foreground">{r.revenue_cents > 0 ? fmtPct(((r.commission_cents || 0) / r.revenue_cents) * 100, 1) : '—'}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{totalSales}</td>
                <td className="py-2 text-right tabular-nums">{fmtCurrency(totalRev)}</td>
                {hasCommission && <td className="py-2 text-right tabular-nums">{fmtCurrency(totalComm)}</td>}
                {hasCommission && <td className="py-2 text-right tabular-nums">{totalRev > 0 ? fmtPct((totalComm / totalRev) * 100, 1) : '—'}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
