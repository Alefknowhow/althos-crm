'use client'

/**
 * Small presentational widgets used by FinancialDashboard (breakdown
 * list/donut, accounts bucket list). Split out of FinancialDashboard.tsx.
 */

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Check } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { carbonColor } from '@/lib/charts/carbon-theme'
import type { AccountsBucketEntry } from '@/actions/financial'
import KpiCard from '@/components/features/dashboard/KpiCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}
function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

// Linhas fixas por bloco (5) — a altura do card nunca muda com a
// quantidade de dados, só o scroll interno aparece quando passa disso.
// Isso é o que garante "estrutura fixa e sólida" mesmo período a período.
const BREAKDOWN_ROWS = 5
const BREAKDOWN_ROW_HEIGHT = 34 // px, por linha (label+valor + barra + gap)

export function BreakdownList({ title, items, total }: {
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

export function BreakdownDonut({ items, total }: {
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

export function AccountsBucket({ title, entries, onQuickPay, tone = 'muted' }: {
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

type StrategicIndicators = {
  burnRateCents: number
  runwayMonths: number | null
  ebitdaCents: number
  pontoEquilibrioCents: number | null
  inadimplenciaPct: number | null
  receitaPrevistaCrmCents: number
}

export function StrategicIndicatorsCard({ data }: { data: StrategicIndicators }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Indicadores estratégicos</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <KpiCard
            compact
            label="Burn rate"
            value={fmtCurrency(data.burnRateCents)}
            help="Média de despesas mensais nos últimos 3 meses."
          />
          <KpiCard
            compact
            label="Runway"
            value={data.runwayMonths === null ? '—' : `${data.runwayMonths.toFixed(1)} meses`}
            help="Saldo em caixa dividido pelo burn rate — quanto tempo o caixa dura no ritmo de gasto atual."
            trend={data.runwayMonths !== null && data.runwayMonths < 3 ? 'down' : 'neutral'}
          />
          <KpiCard
            compact
            label="EBITDA (aprox.)"
            value={fmtCurrency(data.ebitdaCents)}
            help="Aproximação pelo resultado do período — ainda não separa depreciação, juros e impostos."
            mock
          />
          <KpiCard
            compact
            label="Ponto de equilíbrio"
            value={data.pontoEquilibrioCents === null ? '—' : fmtCurrency(data.pontoEquilibrioCents)}
            help="Receita necessária no período pra cobrir custos fixos, dado o custo variável atual."
          />
          <KpiCard
            compact
            label="Inadimplência"
            value={data.inadimplenciaPct === null ? '—' : `${data.inadimplenciaPct.toFixed(1)}%`}
            help="Percentual das contas a receber em aberto que já estão vencidas."
            trend={data.inadimplenciaPct !== null && data.inadimplenciaPct > 15 ? 'down' : 'neutral'}
          />
          <KpiCard
            compact
            label="Receita prevista (CRM)"
            value={fmtCurrency(data.receitaPrevistaCrmCents)}
            help="Soma do valor dos negócios em aberto no funil de vendas — estimativa, não confirmada."
            mock
          />
        </div>
      </CardContent>
    </Card>
  )
}
