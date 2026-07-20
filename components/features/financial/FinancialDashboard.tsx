'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import KpiCard from '@/components/features/dashboard/KpiCard'
import CashFlowChart from './CashFlowChart'
import DailyCashFlowChart from './DailyCashFlowChart'
import ExpensesByCategoryChart from './ExpensesByCategoryChart'
import { getFinancialDashboardData } from '@/actions/financial'
import { PERIOD_OPTIONS, periodToRange, type PeriodId } from '@/lib/utils/period-range'
import { AlertTriangle, Loader2 } from 'lucide-react'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}
function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

type DashboardData = Awaited<ReturnType<typeof getFinancialDashboardData>>

export default function FinancialDashboard({ orgSlug }: { orgSlug: string }) {
  const [period, setPeriod] = useState<PeriodId>('this_month')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => periodToRange(period), [period])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getFinancialDashboardData(orgSlug, range).then(res => {
      if (!cancelled) { setData(res); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [orgSlug, range.from, range.to])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={period} onValueChange={v => setPeriod(v as PeriodId)}>
          <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading || !data ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Receita no período"
              value={fmtCurrency(data.summary.receitas_cents)}
              help="Soma de todos os lançamentos de receita com competência no período selecionado."
            />
            <KpiCard
              label="Despesa no período"
              value={fmtCurrency(data.summary.despesas_cents)}
              help="Soma de todos os lançamentos de despesa com competência no período selecionado."
            />
            <KpiCard
              label="Saldo do período"
              value={fmtCurrency(data.summary.saldo_cents)}
              help="Receita menos despesa do período selecionado."
              trend={data.summary.saldo_cents >= 0 ? 'up' : 'down'}
              trendLabel={data.summary.saldo_cents >= 0 ? 'Positivo' : 'Negativo'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Fluxo de caixa diário (período selecionado)</CardTitle></CardHeader>
              <CardContent>
                {data.dailyCashFlow.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    Nenhum lançamento neste período.
                  </div>
                ) : <DailyCashFlowChart data={data.dailyCashFlow} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Fluxo de caixa (últimos 6 meses)</CardTitle></CardHeader>
              <CardContent><CashFlowChart data={data.monthlyCashFlow} /></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Despesas por categoria (período selecionado)</CardTitle></CardHeader>
              <CardContent>
                {data.expensesByCategory.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    Nenhuma despesa registrada neste período.
                  </div>
                ) : <ExpensesByCategoryChart data={data.expensesByCategory} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Próximos vencimentos</CardTitle></CardHeader>
              <CardContent>
                {data.upcomingDue.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    Nenhum lançamento pendente com vencimento nos próximos 30 dias.
                  </div>
                ) : (
                  <ul className="divide-y max-h-[280px] overflow-y-auto">
                    {data.upcomingDue.map(e => (
                      <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.categoria}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(e.vencimento)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-xs font-semibold tabular-nums ${e.tipo === 'receita' ? 'text-success' : 'text-destructive'}`}>
                            {e.tipo === 'despesa' ? '- ' : ''}{fmtCurrency(e.valor_cents)}
                          </span>
                          {e.status === 'vencido' && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                              <AlertTriangle className="w-3 h-3" /> Vencido
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">DRE simplificado (período selecionado)</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Receita total</td>
                    <td className="py-2 text-right tabular-nums text-success font-semibold">{fmtCurrency(data.dre.receita_total_cents)}</td>
                  </tr>
                  {data.dre.despesas_por_categoria.map(d => (
                    <tr key={d.categoria} className="border-b">
                      <td className="py-2 pl-4 text-muted-foreground">(-) {d.categoria}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{fmtCurrency(d.valor_cents)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-semibold">Resultado</td>
                    <td className={`py-2 text-right tabular-nums font-bold ${data.dre.resultado_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmtCurrency(data.dre.resultado_cents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
