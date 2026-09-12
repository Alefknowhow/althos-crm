import { describe, it, expect } from 'vitest'
import {
  pctDelta, trendOf, buildKpi, computeCashFlowSeries, groupSum,
  computeRevenueBreakdown, computeExpenseBreakdown,
} from '@/lib/financial/reports-calc'

describe('pctDelta', () => {
  it('computes percentage change vs. previous', () => {
    expect(pctDelta(150, 100)).toBe(50)
    expect(pctDelta(50, 100)).toBe(-50)
  })

  it('returns null when there is no comparison base (previous = 0) — never Infinity/NaN', () => {
    expect(pctDelta(100, 0)).toBeNull()
    expect(pctDelta(0, 0)).toBeNull()
  })

  it('uses absolute value of previous as denominator (handles negative baselines)', () => {
    expect(pctDelta(0, -100)).toBe(100) // went from -100 to 0: +100% improvement
  })
})

describe('trendOf', () => {
  it('treats null delta as neutral', () => {
    expect(trendOf(null, true)).toBe('neutral')
  })

  it('treats sub-0.5% moves as neutral noise, not a real trend', () => {
    expect(trendOf(0.3, true)).toBe('neutral')
    expect(trendOf(-0.4, true)).toBe('neutral')
  })

  it('reports up/down normally when higherIsBetter', () => {
    expect(trendOf(10, true)).toBe('up')
    expect(trendOf(-10, true)).toBe('down')
  })

  it('inverts up/down when higherIsBetter is false (e.g. despesa subindo é ruim)', () => {
    expect(trendOf(10, false)).toBe('down')
    expect(trendOf(-10, false)).toBe('up')
  })
})

describe('buildKpi', () => {
  it('composes value + delta + trend consistently', () => {
    const kpi = buildKpi(1000, 500)
    expect(kpi.value_cents).toBe(1000)
    expect(kpi.delta_pct).toBe(100)
    expect(kpi.trend).toBe('up')
  })

  it('flips trend for higherIsBetter=false without changing the delta sign', () => {
    const kpi = buildKpi(1000, 500, false)
    expect(kpi.delta_pct).toBe(100)
    expect(kpi.trend).toBe('down')
  })
})

describe('computeCashFlowSeries', () => {
  const now = new Date('2026-03-15')

  it('creates exactly `months` buckets ending at the current month', () => {
    const series = computeCashFlowSeries([], 3, now)
    expect(series.map(p => p.month)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('accumulates saldo_cents across months', () => {
    const series = computeCashFlowSeries(
      [
        { tipo: 'receita', valor_cents: 1000, competencia: '2026-01-10' },
        { tipo: 'despesa', valor_cents: 200, competencia: '2026-02-05' },
      ],
      3,
      now,
    )
    expect(series[0].saldo_cents).toBe(1000)
    expect(series[1].saldo_cents).toBe(800)
    expect(series[2].saldo_cents).toBe(800)
  })
})

describe('groupSum', () => {
  it('groups null/empty labels under "Não informado"', () => {
    const result = groupSum([{ label: null, valor_cents: 100 }, { label: '', valor_cents: 50 }])
    expect(result).toEqual([{ label: 'Não informado', valor_cents: 150 }])
  })

  it('sorts descending by value', () => {
    const result = groupSum([{ label: 'a', valor_cents: 10 }, { label: 'b', valor_cents: 90 }])
    expect(result.map(r => r.label)).toEqual(['b', 'a'])
  })
})

describe('computeRevenueBreakdown', () => {
  it('computes ticket médio as the rounded average', () => {
    const breakdown = computeRevenueBreakdown(
      [
        { categoria: 'pacote', forma_pagamento: 'pix', operadora: 'CVC', contato_id: null, valor_cents: 1000, is_recurring: false },
        { categoria: 'pacote', forma_pagamento: 'cartao', operadora: 'CVC', contato_id: null, valor_cents: 3000, is_recurring: true },
      ],
      new Map(),
    )
    expect(breakdown.receitaTotalCents).toBe(4000)
    expect(breakdown.ticketMedioCents).toBe(2000)
    expect(breakdown.receitaRecorrenteCents).toBe(3000)
  })

  it('resolves cliente names via the provided map, falling back to "Cliente removido"', () => {
    const breakdown = computeRevenueBreakdown(
      [{ categoria: 'x', forma_pagamento: 'x', operadora: 'x', contato_id: 'c1', valor_cents: 500, is_recurring: false }],
      new Map(), // c1 not in map — simulates a deleted contato
    )
    expect(breakdown.porCliente).toEqual([{ label: 'Cliente removido', valor_cents: 500 }])
  })

  it('returns zeroed ticket médio for no rows (never divides by zero)', () => {
    expect(computeRevenueBreakdown([], new Map()).ticketMedioCents).toBe(0)
  })
})

describe('computeExpenseBreakdown', () => {
  it('splits fixed (is_recurring) vs. variable spend', () => {
    const breakdown = computeExpenseBreakdown([
      { subcategoria: 'aluguel', centro_custo: 'admin', valor_cents: 2000, is_recurring: true },
      { subcategoria: 'marketing', centro_custo: 'vendas', valor_cents: 1000, is_recurring: false },
    ])
    expect(breakdown.despesaTotalCents).toBe(3000)
    expect(breakdown.fixasCents).toBe(2000)
    expect(breakdown.variaveisCents).toBe(1000)
  })
})
