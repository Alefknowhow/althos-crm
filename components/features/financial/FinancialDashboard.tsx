import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import KpiCard from '@/components/features/dashboard/KpiCard'
import CashFlowChart from './CashFlowChart'
import ExpensesByCategoryChart from './ExpensesByCategoryChart'
import {
  getFinancialSummary, getCashFlowSeries, getExpensesByCategory, getSimpleDRE,
} from '@/actions/financial'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function FinancialDashboard({ orgSlug }: { orgSlug: string }) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [summary, cashFlow, expensesByCategory, dre] = await Promise.all([
    getFinancialSummary(orgSlug, { from, to }),
    getCashFlowSeries(orgSlug, 6),
    getExpensesByCategory(orgSlug, { from, to }),
    getSimpleDRE(orgSlug, { from, to }),
  ])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Receita do mês"
          value={fmtCurrency(summary.receitas_cents)}
          help="Soma de todos os lançamentos de receita com competência no mês atual."
        />
        <KpiCard
          label="Despesa do mês"
          value={fmtCurrency(summary.despesas_cents)}
          help="Soma de todos os lançamentos de despesa com competência no mês atual."
        />
        <KpiCard
          label="Saldo do mês"
          value={fmtCurrency(summary.saldo_cents)}
          help="Receita menos despesa do mês atual."
          trend={summary.saldo_cents >= 0 ? 'up' : 'down'}
          trendLabel={summary.saldo_cents >= 0 ? 'Positivo' : 'Negativo'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Fluxo de caixa (últimos 6 meses)</CardTitle></CardHeader>
          <CardContent><CashFlowChart data={cashFlow} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por categoria (mês atual)</CardTitle></CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                Nenhuma despesa registrada neste mês.
              </div>
            ) : <ExpensesByCategoryChart data={expensesByCategory} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">DRE simplificado (mês atual)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-2 font-medium">Receita total</td>
                <td className="py-2 text-right tabular-nums text-success font-semibold">{fmtCurrency(dre.receita_total_cents)}</td>
              </tr>
              {dre.despesas_por_categoria.map(d => (
                <tr key={d.categoria} className="border-b">
                  <td className="py-2 pl-4 text-muted-foreground">(-) {d.categoria}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmtCurrency(d.valor_cents)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-semibold">Resultado</td>
                <td className={`py-2 text-right tabular-nums font-bold ${dre.resultado_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {fmtCurrency(dre.resultado_cents)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
