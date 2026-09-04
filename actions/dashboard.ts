/**
 * Dashboard actions -- barrel. Split across five files:
 *   - dashboard-core.ts: date-range resolution, KPIs, lead time series,
 *     recent activities, lead sources
 *   - dashboard-funnel.ts: advanced conversion funnel
 *   - dashboard-atrisk.ts: at-risk leads, average time per stage
 *   - dashboard-revenue.ts: revenue forecast, source performance, sellers
 *   - dashboard-timeseries.ts: configurable metric time-series
 * None of these carry 'use server' -- they're plain server-only functions
 * imported by Server Components, not client-invoked Server Actions.
 */

export * from './dashboard-core'
export * from './dashboard-funnel'
export * from './dashboard-atrisk'
export * from './dashboard-revenue'
export * from './dashboard-timeseries'
