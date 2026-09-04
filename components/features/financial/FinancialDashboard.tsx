'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import KpiCard from '@/components/features/dashboard/KpiCard'
import CashFlowChart from './CashFlowChart'
import DailyCashFlowChart from './DailyCashFlowChart'
import CashFlowProjectionChart from './CashFlowProjectionChart'
import ExpensesByCategoryChart from './ExpensesByCategoryChart'
import { getFinancialDashboardData, updateFinancialEntry, type AccountsBucketEntry } from '@/actions/financial'
import { PERIOD_OPTIONS, periodToRange, type PeriodId } from '@/lib/utils/period-range'
import { Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { carbonColor } from '@/lib/charts/carbon-theme'

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

// Linhas fixas por bloco (5) — a altura do card nunca muda com a
// quantidade de dados, só o scroll interno aparece quando passa disso.
// Isso é o que garante "estrutura fixa e sólida" mesmo período a período.
const BREAKDOWN_ROWS = 5
const BREAKDOWN_ROW_HEIGHT = 34 // px, por linha (label+valor + barra + gap)

function BreakdownList({ title, items, total }: {
  title?: string
  items: { label: string; valor_cents: number }[]
  total: number
}) {
  const top = items.slice(0, BREAKDOWN_ROWS)
  return (
    <div className={title ? 'rounded-md border bg-muted/20 p-2.5' : ''}>
      {title && <p className="text-[11px] font-bold uppercase tracking-wide text-foreground mb-2 pb-1.5 border-b">{title}</p>}
      <ul
        className="space-y-2 overflow-y-auto pr-1"
        style={{ height: BREAKDOWN_ROWS * BREAKDOWN_ROW_HEIGHT }}
      >
        {top.length === 0 && (
          <li className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados no período.</li>
        )}
        {top.map((item, i) => {
          const pct = total > 0 ? (item.valor_cents / total) * 100 : 0
          const color = carbonColor(i)
          return (
            <li key={item.label}>
              <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                <span className="truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {item.label}
                </span>
                <span className="tabular-nums font-medium shrink-0">
                  {fmtCurrency(item.valor_cents)} <span className="text-muted-foreground font-normal">({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
                <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Máximo de fatias fixo (top 4 + "Outros" agrupando o resto) — mesma regra
// de estrutura fixa/sólida do BreakdownList, aplicada ao donut.
const DONUT_SLICES = 5
const DONUT_LEGEND_ROW_HEIGHT = 20 // px

function BreakdownDonut({ items, total }: {
  items: { label: string; valor_cents: number }[]
  total: number
}) {
  const sorted = [...items].sort((a, b) => b.valor_cents - a.valor_cents)
  const top = sorted.slice(0, DONUT_SLICES - 1)
  const restSum = sorted.slice(DONUT_SLICES - 1).reduce((a, i) => a + i.valor_cents, 0)
  const slices = restSum > 0 ? [...top, { label: 'Outros', valor_cents: restSum }] : top
  const chartData = slices.map((s, i) => ({ name: s.label, value: s.valor_cents, color: carbonColor(i) }))

  return (
    <div>
      {slices.length === 0 ? (
        <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">Sem dados no período.</div>
      ) : (
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                {chartData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip
                formatter={(v) => fmtCurrency(Number(v) || 0)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))', borderRadius: '0px', border: '1px solid hsl(var(--border))',
                  fontSize: '12px', padding: '8px 10px', color: 'hsl(var(--foreground))',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul
        className="mt-1 space-y-1 overflow-y-auto pr-1"
        style={{ height: DONUT_SLICES * DONUT_LEGEND_ROW_HEIGHT }}
      >
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.valor_cents / total) * 100 : 0
          return (
            <li key={s.label} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: carbonColor(i) }} />
                {s.label}
              </span>
              <span className="tabular-nums shrink-0">
                {fmtCurrency(s.valor_cents)} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AccountsBucket({ title, entries, onQuickPay, tone = 'muted' }: {
  title: string
  entries: AccountsBucketEntry[]
  onQuickPay: (id: string) => void
  tone?: 'destructive' | 'warning' | 'muted'
}) {
  const toneClass = tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : 'text-foreground'
  return (
    <div>
      <p className={`text-xs font-semibold mb-1.5 ${toneClass}`}>{title} ({entries.length})</p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum lançamento.</p>
      ) : (
        <ul className="divide-y max-h-[220px] overflow-y-auto">
          {entries.slice(0, 20).map(e => (
            <li key={e.id} className="py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{e.categoria}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDate(e.vencimento)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-xs font-semibold tabular-nums ${e.tipo === 'receita' ? 'text-success' : 'text-destructive'}`}>
                  {e.tipo === 'despesa' ? '- ' : ''}{fmtCurrency(e.valor_cents)}
                </span>
                <Button size="icon" variant="outline" className="h-6 w-6" title="Marcar como pago" onClick={() => onQuickPay(e.id)}>
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type DashboardData = Awaited<ReturnType<typeof getFinancialDashboardData>>

export default function FinancialDashboard({ orgSlug }: { orgSlug: string }) {
  const [period, setPeriod] = useState<PeriodId>('this_month')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => periodToRange(period), [period])

  function reload() {
    getFinancialDashboardData(orgSlug, range).then(res => setData(res))
  }

  async function handleQuickPay(id: string) {
    const res = await updateFinancialEntry(orgSlug, id, { status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) })
    if (res.ok) { toast.success('Marcado como pago'); reload() }
    else toast.error(res.error)
  }

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
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2 -mt-2 flex justify-end flex-wrap gap-1.5 bg-secondary/40 backdrop-blur supports-[backdrop-filter]:bg-secondary/70">
        {PERIOD_OPTIONS.map(p => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={period === p.id ? 'default' : 'outline'}
            className="h-8 text-xs"
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </Button>
        ))}
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard compact label="Ticket médio" value={fmtCurrency(data.revenueBreakdown.ticketMedioCents)} help="Receita total dividida pelo número de lançamentos de receita no período." />
            <KpiCard compact label="Receita recorrente" value={fmtCurrency(data.revenueBreakdown.receitaRecorrenteCents)} help="Soma dos lançamentos de receita marcados como recorrentes." />
            <KpiCard compact label="Despesas fixas" value={fmtCurrency(data.expenseBreakdown.fixasCents)} help="Soma dos lançamentos de despesa recorrentes." />
            <KpiCard compact label="Despesas variáveis" value={fmtCurrency(data.expenseBreakdown.variaveisCents)} help="Soma dos lançamentos de despesa não recorrentes." />
          </div>

          {/* Receitas segmentadas — 4 blocos estreitos (~20% cada), 2 à
              esquerda + 2 à direita, em vez de 2 cards largos empilhados. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por categoria</CardTitle></CardHeader>
              <CardContent><BreakdownDonut items={data.revenueBreakdown.porCategoria} total={data.revenueBreakdown.receitaTotalCents} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por cliente</CardTitle></CardHeader>
              <CardContent><BreakdownList title="Receita" items={data.revenueBreakdown.porCliente} total={data.revenueBreakdown.receitaTotalCents} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por forma de pagamento</CardTitle></CardHeader>
              <CardContent><BreakdownDonut items={data.revenueBreakdown.porFormaPagamento} total={data.revenueBreakdown.receitaTotalCents} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por operadora</CardTitle></CardHeader>
              <CardContent><BreakdownDonut items={data.revenueBreakdown.porOperadora} total={data.revenueBreakdown.receitaTotalCents} /></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Despesas segmentadas — por subcategoria</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <BreakdownDonut items={data.expenseBreakdown.porSubcategoria} total={data.expenseBreakdown.despesaTotalCents} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Despesas segmentadas — por centro de custo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <BreakdownDonut items={data.expenseBreakdown.porCentroCusto} total={data.expenseBreakdown.despesaTotalCents} />
              </CardContent>
            </Card>
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
          </div>

          {data.alerts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Alertas inteligentes</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {data.alerts.map((a, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm p-2.5 border ${a.kind === 'risk' ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5'}`}>
                      <span className={`mt-0.5 shrink-0 ${a.kind === 'risk' ? 'text-destructive' : 'text-success'}`}>
                        {a.kind === 'risk' ? '⚠' : '↑'}
                      </span>
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Indicadores estratégicos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <KpiCard
                  compact
                  label="Burn rate"
                  value={fmtCurrency(data.strategicIndicators.burnRateCents)}
                  help="Média de despesas mensais nos últimos 3 meses."
                />
                <KpiCard
                  compact
                  label="Runway"
                  value={data.strategicIndicators.runwayMonths === null ? '—' : `${data.strategicIndicators.runwayMonths.toFixed(1)} meses`}
                  help="Saldo em caixa dividido pelo burn rate — quanto tempo o caixa dura no ritmo de gasto atual."
                  trend={data.strategicIndicators.runwayMonths !== null && data.strategicIndicators.runwayMonths < 3 ? 'down' : 'neutral'}
                />
                <KpiCard
                  compact
                  label="EBITDA (aprox.)"
                  value={fmtCurrency(data.strategicIndicators.ebitdaCents)}
                  help="Aproximação pelo resultado do período — ainda não separa depreciação, juros e impostos."
                  mock
                />
                <KpiCard
                  compact
                  label="Ponto de equilíbrio"
                  value={data.strategicIndicators.pontoEquilibrioCents === null ? '—' : fmtCurrency(data.strategicIndicators.pontoEquilibrioCents)}
                  help="Receita necessária no período pra cobrir custos fixos, dado o custo variável atual."
                />
                <KpiCard
                  compact
                  label="Inadimplência"
                  value={data.strategicIndicators.inadimplenciaPct === null ? '—' : `${data.strategicIndicators.inadimplenciaPct.toFixed(1)}%`}
                  help="Percentual das contas a receber em aberto que já estão vencidas."
                  trend={data.strategicIndicators.inadimplenciaPct !== null && data.strategicIndicators.inadimplenciaPct > 15 ? 'down' : 'neutral'}
                />
                <KpiCard
                  compact
                  label="Receita prevista (CRM)"
                  value={fmtCurrency(data.strategicIndicators.receitaPrevistaCrmCents)}
                  help="Soma do valor dos negócios em aberto no funil de vendas — estimativa, não confirmada."
                  mock
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Contas</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AccountsBucket title="Vencidas" entries={data.accountsOverview.vencidas} onQuickPay={handleQuickPay} tone="destructive" />
                <AccountsBucket title="Vencem hoje" entries={data.accountsOverview.hoje} onQuickPay={handleQuickPay} tone="warning" />
                <AccountsBucket title="Esta semana" entries={data.accountsOverview.estaSemana} onQuickPay={handleQuickPay} />
                <AccountsBucket title="Este mês" entries={data.accountsOverview.esteMes} onQuickPay={handleQuickPay} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">DRE simplificado (período selecionado)</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[320px] overflow-y-auto">
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
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
