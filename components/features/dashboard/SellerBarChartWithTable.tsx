'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users } from 'lucide-react'
import { carbonColor } from '@/lib/charts/carbon-theme'
import SellerBarChart from './SellerBarChart'
import { CHART_CARD_H } from './dashboardSizes'

export type SellerComparisonDisplayRow = {
  seller_id: string | null
  name: string
  sales_count: number
  revenue_cents: number
  commission_cents: number | null
  avg_ticket_cents: number
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default function SellerBarChartWithTable({ rows, hasCommission }: { rows: SellerComparisonDisplayRow[]; hasCommission: boolean }) {
  return (
    <Card className={`${CHART_CARD_H} flex flex-col`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Comparativo entre vendedores
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Faturamento, comissão e ticket médio por vendedor no período.</p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
        ) : (
          <>
            <div className="h-[160px] shrink-0">
              <SellerBarChart data={rows} />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Nº vendas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    {hasCommission && <TableHead className="text-right">Comissão</TableHead>}
                    {hasCommission && <TableHead className="text-right">% Comissão</TableHead>}
                    <TableHead className="text-right">Ticket médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.seller_id || i}>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: carbonColor(i) }} />
                          {r.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{r.sales_count}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(r.revenue_cents)}</TableCell>
                      {hasCommission && (
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.commission_cents != null ? fmtCurrency(r.commission_cents) : '—'}
                        </TableCell>
                      )}
                      {hasCommission && (
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.commission_cents != null && r.revenue_cents > 0
                            ? `${((r.commission_cents / r.revenue_cents) * 100).toFixed(1)}%`
                            : '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(r.avg_ticket_cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
