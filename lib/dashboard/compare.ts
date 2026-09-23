/**
 * Comparação com o período anterior para os indicadores do Dashboard (issue
 * #26). Regra: valor anterior ausente ou zero NUNCA vira "0%"/infinito — vira
 * o estado explícito "Sem base de comparação", pra não sugerir estabilidade
 * ou tendência que os dados não sustentam.
 */

export type Trend = 'up' | 'down' | 'neutral'
export type Comparison = { trend: Trend; trendLabel: string }

export const NO_BASELINE: Comparison = { trend: 'neutral', trendLabel: 'Sem base de comparação' }

/** Variação percentual relativa — para valores absolutos (receita, contagens). */
export function compareValues(current: number, previous: number | null | undefined): Comparison {
  if (previous === null || previous === undefined || previous <= 0) return NO_BASELINE
  const pct = ((current - previous) / previous) * 100
  const trend: Trend = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'neutral'
  const sign = pct > 0 ? '+' : ''
  return { trend, trendLabel: `${sign}${pct.toFixed(1)}% vs. período anterior` }
}

/** Variação em pontos percentuais — para taxas (ex.: conversão), onde
 *  comparar "% de %" confundiria mais do que ajudaria. */
export function comparePoints(currentPct: number, previousPct: number | null | undefined): Comparison {
  if (previousPct === null || previousPct === undefined) return NO_BASELINE
  const diff = currentPct - previousPct
  const trend: Trend = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'neutral'
  const sign = diff > 0 ? '+' : ''
  return { trend, trendLabel: `${sign}${diff.toFixed(1)} p.p. vs. período anterior` }
}
