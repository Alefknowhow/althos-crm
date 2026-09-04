import type { FunnelPeriod } from './dashboard-funnel'

/**
 * Resolves a FunnelPeriod into a window start date. Split out of
 * actions/dashboard-funnel.ts — shared by getAdvancedFunnel and
 * getStageThroughput (dashboard-funnel-throughput.ts).
 */
export function funnelWindowStart(period: FunnelPeriod): Date | null {
  if (period === 'all') return null
  const now = new Date()
  const d = new Date()
  switch (period) {
    case '7d':
      d.setDate(now.getDate() - 7)
      return d
    case '90d':
      d.setDate(now.getDate() - 90)
      return d
    case 'mtd':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'qtd':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1)
    case '30d':
    default:
      d.setDate(now.getDate() - 30)
      return d
  }
}
