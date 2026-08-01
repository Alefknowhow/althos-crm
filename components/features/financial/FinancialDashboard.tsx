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
import CashFlowProjectionChart from './CashFlowProjectionChart'
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
function fmtPct(pct: number | null): string | undefined {
  if (pct === null) return undefined
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% vs. período anterior`
}
function fmtPctPoints(curr: number | null, prev: number | null): string | undefined {
  if (curr === null || prev === null) return undefined
  const diff = curr - prev
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}p.p. vs. período anterior`
}

function BreakdownList({ title, items, total, tone = 'success' }: {
  title: string
  items: { label: string; valor_cents: number }[]
  total: number
  tone?: 'success' | 'destructive'
}) {
  const top = items.slice(0, 5)
  if (top.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">{title}</p>
        <p className="text-xs text-muted-foreground">Sem dados no período.</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{title}</p>
      <ul className="space-y-1.5">
        {top.map(item => {
          const pct = total > 0 ? (item.valor_cents / total) * 100 : 0
          return (
            <li key={item.label}>
              <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                <span className="truncate">{item.label}</span>
                <span className="tabular-nums font-medium shrink-0">{fmtCurrency(item.valor_cents)}</span>
              </div>
              <div className="h-1.5 w-full bg-muted overflow-hidden">
                <div className={`h-full ${tone === 'success' ? 'bg-success' : 'bg-destructive'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Saldo em caixa"
              value={fmtCurrency(data.kpis.saldoEmCaixa.value_cents)}
              help="Posição acumulada de caixa (só lançamentos efetivamente pagos) até o fim do período selecionado."
              trend={data.kpis.saldoEmCaixa.trend}
              trendLabel={fmtPct(data.kpis.saldoEmCaixa.delta_pct)}
            />
            <KpiCard
              label="Receita do período"
              value={fmtCurrency(data.kpis.receitaDoMes.value_cents)}
              help="Soma de todos os lançamentos de receita com competência no período selecionado."
              trend={data.kpis.receitaDoMes.trend}
              trendLabel={fmtPct(data.kpis.receitaDoMes.delta_pct)}
            />
            <KpiCard
              label="Despesa do período"
              value={fmtCurrency(data.kpis.despesaDoMes.value_cents)}
              help="Soma de todos os lançamentos de despesa com competência no período selecionado."
              trend={data.kpis.despesaDoMes.trend}
              trendLabel={fmtPct(data.kpis.despesaDoMes.delta_pct)}
            />
            <KpiCard
              label="Lucro líquido"
              value={fmtCurrency(data.kpis.lucroLiquido.value_cents)}
              help="Receita menos despesa do período selecionado."
              trend={data.kpis.lucroLiquido.trend}
              trendLabel={fmtPct(data.kpis.lucroLiquido.delta_pct)}
            />
            <KpiCard
              label="Margem de lucro"
              value={data.kpis.margemLucroPct === null ? '—' : `${data.kpis.margemLucroPct.toFixed(1)}%`}
              help="Lucro líquido dividido pela receita do período."
              trend={
                data.kpis.margemLucroPct === null || data.kpis.margemLucroPctPrev === null
                  ? 'neutral'
                  : data.kpis.margemLucroPct >= data.kpis.margemLucroPctPrev ? 'up' : 'down'
              }
              trendLabel={fmtPctPoints(data.kpis.margemLucroPct, data.kpis.margemLucroPctPrev)}
            />
            <KpiCard
              label="Fluxo de caixa previsto"
              value={fmtCurrency(data.kpis.fluxoCaixaPrevistoCents)}
              help="Receitas pendentes menos despesas pendentes com vencimento dentro do período selecionado."
              trend={data.kpis.fluxoCaixaPrevistoCents >= 0 ? 'up' : 'down'}
            />
            <KpiCard
              label="Contas a receber"
              value={fmtCurrency(data.kpis.contasAReceberCents)}
              help="Total de receitas pendentes ou vencidas em aberto, na posição atual."
            />
            <KpiCard
              label="Contas a pagar"
              value={fmtCurrency(data.kpis.contasAPagarCents)}
              help="Total de despesas pendentes ou vencidas em aberto, na posição atual."
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

          <Card>
            <CardHeader><CardTitle className="text-base">Projeção de caixa (próximos 90 dias)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard
                  label="Saldo previsto em 30 dias"
                  value={fmtCurrency(data.cashFlowProjection.checkpoints.d30)}
                  help="Saldo em caixa atual somado às receitas e despesas já lançadas (pendentes/vencidas) com vencimento até 30 dias."
                  trend={data.cashFlowProjection.checkpoints.d30 >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                  label="Saldo previsto em 60 dias"
                  value={fmtCurrency(data.cashFlowProjection.checkpoints.d60)}
                  help="Mesma projeção, horizonte de 60 dias."
                  trend={data.cashFlowProjection.checkpoints.d60 >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                  label="Saldo previsto em 90 dias"
                  value={fmtCurrency(data.cashFlowProjection.checkpoints.d90)}
                  help="Mesma projeção, horizonte de 90 dias."
                  trend={data.cashFlowProjection.checkpoints.d90 >= 0 ? 'up' : 'down'}
                />
              </div>
              {data.cashFlowProjection.series.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem lançamentos pendentes pra projetar.
                </div>
              ) : <CashFlowProjectionChart data={data.cashFlowProjection.series} />}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Receitas segmentadas (período selecionado)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard label="Ticket médio" value={fmtCurrency(data.revenueBreakdown.ticketMedioCents)} help="Receita total dividida pelo número de lançamentos de receita no período." />
                  <KpiCard label="Receita recorrente" value={fmtCurrency(data.revenueBreakdown.receitaRecorrenteCents)} help="Soma dos lançamentos de receita marcados como recorrentes." />
                </div>
                <BreakdownList title="Por categoria" items={data.revenueBreakdown.porCategoria} total={data.revenueBreakdown.receitaTotalCents} />
                <BreakdownList title="Por cliente" items={data.revenueBreakdown.porCliente} total={data.revenueBreakdown.receitaTotalCents} />
                <BreakdownList title="Por forma de pagamento" items={data.revenueBreakdown.porFormaPagamento} total={data.revenueBreakdown.receitaTotalCents} />
                <BreakdownList title="Por operadora" items={data.revenueBreakdown.porOperadora} total={data.revenueBreakdown.receitaTotalCents} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Despesas segmentadas (período selecionado)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard label="Despesas fixas" value={fmtCurrency(data.expenseBreakdown.fixasCents)} help="Soma dos lançamentos de despesa recorrentes." />
                  <KpiCard label="Despesas variáveis" value={fmtCurrency(data.expenseBreakdown.variaveisCents)} help="Soma dos lançamentos de despesa não recorrentes." />
                </div>
                <BreakdownList title="Por subcategoria" items={data.expenseBreakdown.porSubcategoria} total={data.expenseBreakdown.despesaTotalCents} tone="destructive" />
                <BreakdownList title="Por centro de custo" items={data.expenseBreakdown.porCentroCusto} total={data.expenseBreakdown.despesaTotalCents} tone="destructive" />
              </CardContent>
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
