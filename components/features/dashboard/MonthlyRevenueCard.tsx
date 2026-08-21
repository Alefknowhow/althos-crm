'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp } from 'lucide-react'
import ComboBarLineChart from './ComboBarLineChart'
import { CHART_CARD_H } from './dashboardSizes'
import type { ComboBarLinePoint } from './ComboBarLineChartInner'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default function MonthlyRevenueCard({ rows, hasCommission }: { rows: ComboBarLinePoint[]; hasCommission: boolean }) {
  return (
    <Card className={`${CHART_CARD_H} flex flex-col`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Faturamento{hasCommission ? ' & Comissão' : ''} por mês
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {hasCommission
            ? 'Barras = faturamento (eixo esquerdo) · Linha = comissão (eixo direito), últimos 6 meses.'
            : 'Faturamento total por mês, últimos 6 meses.'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
        ) : (
          <>
            <div className="h-[160px] shrink-0">
              <ComboBarLineChart data={rows} hasCommission={hasCommission} />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    {hasCommission && <TableHead className="text-right">Comissão</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.label}>
                      <TableCell className="text-sm">{r.label}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{r.sales_count}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtCurrency(r.revenue_cents)}</TableCell>
                      {hasCommission && (
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.commission_cents != null ? fmtCurrency(r.commission_cents) : '—'}
                        </TableCell>
                      )}
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
