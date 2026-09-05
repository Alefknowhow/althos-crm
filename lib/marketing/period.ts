/**
 * Pure period-window helper shared by marketing actions and (at least) one
 * client panel. Not a server action — moved out of actions/marketing-overview.ts
 * because a 'use server' file can only export async functions; this is a
 * plain sync calculation with no I/O.
 */

export type MarketingPeriod = '7d' | '30d' | '90d' | 'mtd' | 'max'

// Data-teto pra "Máximo" — bem antes de qualquer conta de anúncio real, só
// pra servir de `since` sem período final (busca tudo que existir).
const MAX_PERIOD_START = '2015-01-01'

export function periodStart(period: MarketingPeriod): string {
  const now = new Date()
  if (period === 'max') return MAX_PERIOD_START
  if (period === 'mtd') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
