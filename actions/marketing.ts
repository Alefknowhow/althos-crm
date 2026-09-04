/**
 * Marketing / Ads actions -- barrel. Split across five files (this one
 * has just the shared Provider type and re-exports):
 *   - marketing-accounts.ts: ad account CRUD + Meta Ads login status
 *   - marketing-campaigns.ts: campaign CRUD + metric recording/sync
 *   - marketing-connect.ts: Meta Ads OAuth connection flow
 *   - marketing-overview.ts: dashboard aggregation + metric prefs
 *   - marketing-drilldown.ts: campaign/ad-set/ad drill-down
 * No 'use server' needed here -- it only re-exports async functions
 * defined in files that each carry their own 'use server'.
 */

export type Provider = 'meta' | 'google' | 'tiktok' | 'other'

export * from './marketing-accounts'
export * from './marketing-campaigns'
export * from './marketing-connect'
export * from './marketing-overview'
export * from './marketing-drilldown'
