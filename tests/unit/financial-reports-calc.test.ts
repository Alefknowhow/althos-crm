import { describe, it, expect } from 'vitest'
import { computeSimpleDRE, computeDailyCashFlow, computeCashFlowProjection } from '@/lib/financial/reports-calc'

describe('computeSimpleDRE', () => {
  it('sums revenue and groups expenses by category', () => {
    const dre = computeSimpleDRE([
      { tipo: 'receita', categoria: 'vendas', valor_cents: 10000 },
      { tipo: 'receita', categoria: 'vendas', valor_cents: 5000 },
      { tipo: 'despesa', categoria: 'aluguel', valor_cents: 3000 },
      { tipo: 'despesa', categoria: 'salarios', valor_cents: 4000 },
      { tipo: 'despesa', categoria: 'aluguel', valor_cents: 1000 },
    ])
    expect(dre.receita_total_cents).toBe(15000)
    // Empate em valor (4000 cada) — ordem de desempate é a de primeira
    // aparição (Map preserva a ordem de inserção da CHAVE, não da atualização;
    // "aluguel" apareceu primeiro no array de entrada).
    expect(dre.despesas_por_categoria).toEqual([
      { categoria: 'aluguel', valor_cents: 4000 },
      { categoria: 'salarios', valor_cents: 4000 },
    ])
    expect(dre.resultado_cents).toBe(15000 - 8000)
  })

  it('returns zeroed DRE for no rows', () => {
    const dre = computeSimpleDRE([])
    expect(dre).toEqual({ receita_total_cents: 0, despesas_por_categoria: [], resultado_cents: 0 })
  })

  it('sorts expense categories descending by value', () => {
    const dre = computeSimpleDRE([
      { tipo: 'despesa', categoria: 'a', valor_cents: 100 },
      { tipo: 'despesa', categoria: 'b', valor_cents: 500 },
      { tipo: 'despesa', categoria: 'c', valor_cents: 300 },
    ])
    expect(dre.despesas_por_categoria.map(d => d.categoria)).toEqual(['b', 'c', 'a'])
  })
})

describe('computeDailyCashFlow', () => {
  it('creates one zeroed bucket per day in range, even without entries', () => {
    const points = computeDailyCashFlow([], { from: '2026-01-01', to: '2026-01-03' })
    expect(points.map(p => p.day)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(points.every(p => p.receitas_cents === 0 && p.despesas_cents === 0)).toBe(true)
  })

  it('accumulates a running balance (saldo_cents) across days', () => {
    const points = computeDailyCashFlow(
      [
        { tipo: 'receita', valor_cents: 1000, competencia: '2026-01-01' },
        { tipo: 'despesa', valor_cents: 300, competencia: '2026-01-02' },
        { tipo: 'receita', valor_cents: 200, competencia: '2026-01-03' },
      ],
      { from: '2026-01-01', to: '2026-01-03' },
    )
    expect(points[0].saldo_cents).toBe(1000)
    expect(points[1].saldo_cents).toBe(700)
    expect(points[2].saldo_cents).toBe(900)
  })

  it('ignores rows whose competencia falls outside the requested range', () => {
    const points = computeDailyCashFlow(
      [{ tipo: 'receita', valor_cents: 999, competencia: '2025-12-31' }],
      { from: '2026-01-01', to: '2026-01-02' },
    )
    expect(points.every(p => p.receitas_cents === 0)).toBe(true)
  })
})

describe('computeCashFlowProjection', () => {
  const today = new Date('2026-01-01T12:00:00Z')

  it('starts from the sum of paid entries (receita adds, despesa subtracts)', () => {
    const proj = computeCashFlowProjection(
      [
        { tipo: 'receita', valor_cents: 10000 },
        { tipo: 'despesa', valor_cents: 4000 },
      ],
      [],
      30,
      today,
    )
    expect(proj.startingBalance_cents).toBe(6000)
    expect(proj.series.every(p => p.saldo_previsto_cents === 6000)).toBe(true)
  })

  it('applies pending entries on their due date and carries the balance forward', () => {
    const proj = computeCashFlowProjection(
      [],
      [{ tipo: 'receita', valor_cents: 1000, vencimento: '2026-01-05' }],
      10,
      today,
    )
    const day4 = proj.series.find(p => p.day === '2026-01-04')!
    const day5 = proj.series.find(p => p.day === '2026-01-05')!
    const day6 = proj.series.find(p => p.day === '2026-01-06')!
    expect(day4.saldo_previsto_cents).toBe(0)
    expect(day5.saldo_previsto_cents).toBe(1000)
    expect(day6.saldo_previsto_cents).toBe(1000) // carries forward, doesn't reset
  })

  it('sets d30/d60/d90 checkpoints to the running balance at those exact offsets', () => {
    const proj = computeCashFlowProjection(
      [],
      [{ tipo: 'receita', valor_cents: 500, vencimento: '2026-01-31' }], // today + 30 days
      90,
      today,
    )
    expect(proj.checkpoints.d30).toBe(500)
    expect(proj.checkpoints.d60).toBe(500)
    expect(proj.checkpoints.d90).toBe(500)
  })

  it('produces exactly horizonDays points, starting at today+1 (not today itself)', () => {
    const proj = computeCashFlowProjection([], [], 5, today)
    expect(proj.series).toHaveLength(5)
    expect(proj.series[0].day).toBe('2026-01-02')
    expect(proj.series[4].day).toBe('2026-01-06')
  })
})
