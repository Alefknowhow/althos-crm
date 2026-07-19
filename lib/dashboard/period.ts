import type { Period } from '@/actions/dashboard'

/** Same window semantics as `getDashboardMetrics`/`getMetricTimeSeries`, for
 *  helpers that need a raw `Date` instead of a `Period`. */
export function sinceFromPeriod(period: Period): Date {
  const d = new Date()
  switch (period) {
    case 'today': d.setHours(0, 0, 0, 0); break
    case '7d': d.setDate(d.getDate() - 7); break
    case '90d': d.setDate(d.getDate() - 90); break
    case '30d':
    default: d.setDate(d.getDate() - 30); break
  }
  return d
}
