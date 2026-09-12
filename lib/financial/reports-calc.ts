/**
 * Lógica pura dos relatórios financeiros — extraída de
 * actions/financial-reports.ts (que faz só o fetch + chama estas funções)
 * pra ser testável sem mockar Supabase. Nenhuma destas funções faz I/O.
 */

export type FinancialRow = { tipo: 'receita' | 'despesa'; categoria: string; valor_cents: number }

export type SimpleDRE = {
  receita_total_cents: number
  despesas_por_categoria: { categoria: string; valor_cents: number }[]
  resultado_cents: number
}

export function computeSimpleDRE(rows: FinancialRow[]): SimpleDRE {
  let receita_total_cents = 0
  const despesasMap = new Map<string, number>()
  for (const row of rows) {
    if (row.tipo === 'receita') {
      receita_total_cents += row.valor_cents
    } else {
      despesasMap.set(row.categoria, (despesasMap.get(row.categoria) || 0) + row.valor_cents)
    }
  }
  const despesas_por_categoria = Array.from(despesasMap.entries())
    .map(([categoria, valor_cents]) => ({ categoria, valor_cents }))
    .sort((a, b) => b.valor_cents - a.valor_cents)
  const despesas_total_cents = despesas_por_categoria.reduce((a, d) => a + d.valor_cents, 0)

  return { receita_total_cents, despesas_por_categoria, resultado_cents: receita_total_cents - despesas_total_cents }
}

export type DailyCashFlowRow = { tipo: 'receita' | 'despesa'; valor_cents: number; competencia: string }
export type DailyCashFlowPoint = { day: string; receitas_cents: number; despesas_cents: number; saldo_cents: number }

/** `from`/`to` no formato 'YYYY-MM-DD'. Gera um bucket por dia no intervalo,
 *  mesmo sem lançamento naquele dia (zerado), e acumula o saldo corrido. */
export function computeDailyCashFlow(rows: DailyCashFlowRow[], range: { from: string; to: string }): DailyCashFlowPoint[] {
  const buckets = new Map<string, { receitas_cents: number; despesas_cents: number }>()
  const start = new Date(range.from + 'T12:00:00')
  const end = new Date(range.to + 'T12:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    buckets.set(d.toISOString().slice(0, 10), { receitas_cents: 0, despesas_cents: 0 })
  }

  for (const row of rows) {
    const bucket = buckets.get(row.competencia)
    if (!bucket) continue
    if (row.tipo === 'receita') bucket.receitas_cents += row.valor_cents
    else bucket.despesas_cents += row.valor_cents
  }

  let running = 0
  return Array.from(buckets.entries()).map(([day, v]) => {
    running += v.receitas_cents - v.despesas_cents
    return { day, ...v, saldo_cents: running }
  })
}

export type CashFlowProjectionPoint = { day: string; saldo_previsto_cents: number }
export type CashFlowProjection = {
  startingBalance_cents: number
  series: CashFlowProjectionPoint[]
  checkpoints: { d30: number; d60: number; d90: number }
}

/**
 * `paidRows` = lançamentos já pagos (compõem o saldo inicial). `pendingRows`
 * = pendentes/vencidos com vencimento definido, projetados dia a dia a
 * partir de `today` (exclusive — o dia 1 da série é today+1).
 */
export function computeCashFlowProjection(
  paidRows: { tipo: 'receita' | 'despesa'; valor_cents: number }[],
  pendingRows: { tipo: 'receita' | 'despesa'; valor_cents: number; vencimento: string }[],
  horizonDays: number,
  today: Date,
): CashFlowProjection {
  const startingBalance = paidRows.reduce((a, r) => a + (r.tipo === 'receita' ? r.valor_cents : -r.valor_cents), 0)

  const byDay = new Map<string, number>()
  for (const row of pendingRows) {
    const v = row.tipo === 'receita' ? row.valor_cents : -row.valor_cents
    byDay.set(row.vencimento, (byDay.get(row.vencimento) || 0) + v)
  }

  const series: CashFlowProjectionPoint[] = []
  let running = startingBalance
  const checkpoints = { d30: startingBalance, d60: startingBalance, d90: startingBalance }
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    running += byDay.get(key) || 0
    series.push({ day: key, saldo_previsto_cents: running })
    if (i === 30) checkpoints.d30 = running
    if (i === 60) checkpoints.d60 = running
    if (i === 90) checkpoints.d90 = running
  }

  return { startingBalance_cents: startingBalance, series, checkpoints }
}

// ── Extraído de actions/financial-summary.ts ────────────────────────────────

export type KpiValue = { value_cents: number; delta_pct: number | null; trend: 'up' | 'down' | 'neutral' }

/** % de variação vs. período anterior — null quando não há base de
 *  comparação (anterior = 0), pra não inventar percentual sem sentido
 *  (ex.: "infinito%" ou "0% quando era 0 e virou 0"). */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Direção do indicador — abaixo de 0.5% de variação é tratado como
 *  estável ('neutral'), não como alta/baixa ruidosa. `higherIsBetter`
 *  inverte o sentido pra métricas onde menor é melhor (ex.: despesa). */
export function trendOf(delta: number | null, higherIsBetter: boolean): 'up' | 'down' | 'neutral' {
  if (delta === null || Math.abs(delta) < 0.5) return 'neutral'
  const up = delta > 0
  return (higherIsBetter ? up : !up) ? 'up' : 'down'
}

export function buildKpi(current: number, previous: number, higherIsBetter = true): KpiValue {
  const delta = pctDelta(current, previous)
  return { value_cents: current, delta_pct: delta, trend: trendOf(delta, higherIsBetter) }
}

export type CashFlowSeriesRow = { tipo: 'receita' | 'despesa'; valor_cents: number; competencia: string }
export type CashFlowSeriesPoint = { month: string; receitas_cents: number; despesas_cents: number; saldo_cents: number }

/** Série mensal (últimos `months` meses até `now`, inclusive), com saldo
 *  corrido — mesma lógica de linha corrida do fluxo de caixa diário, só
 *  que bucketizada por mês (YYYY-MM) em vez de por dia. */
export function computeCashFlowSeries(rows: CashFlowSeriesRow[], months: number, now: Date): CashFlowSeriesPoint[] {
  const buckets = new Map<string, { receitas_cents: number; despesas_cents: number }>()
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { receitas_cents: 0, despesas_cents: 0 })
  }

  for (const row of rows) {
    const key = row.competencia.slice(0, 7)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (row.tipo === 'receita') bucket.receitas_cents += row.valor_cents
    else bucket.despesas_cents += row.valor_cents
  }

  let running = 0
  return Array.from(buckets.entries()).map(([month, v]) => {
    running += v.receitas_cents - v.despesas_cents
    return { month, ...v, saldo_cents: running }
  })
}

/** Agrupa e soma por rótulo (categoria/forma de pagamento/centro de custo/
 *  etc.), tratando label nulo/vazio como "Não informado", ordenado do
 *  maior valor pro menor. */
export function groupSum(rows: { label: string | null; valor_cents: number }[]): { label: string; valor_cents: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const key = r.label || 'Não informado'
    map.set(key, (map.get(key) || 0) + r.valor_cents)
  }
  return Array.from(map.entries()).map(([label, valor_cents]) => ({ label, valor_cents })).sort((a, b) => b.valor_cents - a.valor_cents)
}

export type RevenueRow = {
  categoria: string | null
  forma_pagamento: string | null
  operadora: string | null
  contato_id: string | null
  valor_cents: number
  is_recurring: boolean | null
}
export type RevenueBreakdown = {
  porCategoria: { label: string; valor_cents: number }[]
  porFormaPagamento: { label: string; valor_cents: number }[]
  porOperadora: { label: string; valor_cents: number }[]
  porCliente: { label: string; valor_cents: number }[]
  ticketMedioCents: number
  receitaRecorrenteCents: number
  receitaTotalCents: number
}

/** `contatoNames` já resolvido pelo caller (map contato_id -> nome) — esta
 *  função não faz I/O, só agrega o que já foi buscado. */
export function computeRevenueBreakdown(rows: RevenueRow[], contatoNames: Map<string, string>): RevenueBreakdown {
  const receitaTotalCents = rows.reduce((a, r) => a + r.valor_cents, 0)
  const receitaRecorrenteCents = rows.filter(r => r.is_recurring).reduce((a, r) => a + r.valor_cents, 0)
  const ticketMedioCents = rows.length > 0 ? Math.round(receitaTotalCents / rows.length) : 0

  return {
    porCategoria: groupSum(rows.map(r => ({ label: r.categoria, valor_cents: r.valor_cents }))),
    porFormaPagamento: groupSum(rows.map(r => ({ label: r.forma_pagamento, valor_cents: r.valor_cents }))),
    porOperadora: groupSum(rows.map(r => ({ label: r.operadora, valor_cents: r.valor_cents }))),
    porCliente: groupSum(rows.map(r => ({ label: r.contato_id ? contatoNames.get(r.contato_id) || 'Cliente removido' : null, valor_cents: r.valor_cents }))),
    ticketMedioCents,
    receitaRecorrenteCents,
    receitaTotalCents,
  }
}

export type ExpenseRow = { subcategoria: string | null; centro_custo: string | null; valor_cents: number; is_recurring: boolean | null }
export type ExpenseBreakdown = {
  porSubcategoria: { label: string; valor_cents: number }[]
  porCentroCusto: { label: string; valor_cents: number }[]
  fixasCents: number
  variaveisCents: number
  despesaTotalCents: number
}

export function computeExpenseBreakdown(rows: ExpenseRow[]): ExpenseBreakdown {
  const despesaTotalCents = rows.reduce((a, r) => a + r.valor_cents, 0)
  const fixasCents = rows.filter(r => r.is_recurring).reduce((a, r) => a + r.valor_cents, 0)

  return {
    porSubcategoria: groupSum(rows.map(r => ({ label: r.subcategoria, valor_cents: r.valor_cents }))),
    porCentroCusto: groupSum(rows.map(r => ({ label: r.centro_custo, valor_cents: r.valor_cents }))),
    fixasCents,
    variaveisCents: despesaTotalCents - fixasCents,
    despesaTotalCents,
  }
}
