/**
 * Financial actions -- barrel. Split across seven files:
 *   - financial-shared.ts: FinancialEntryRow type, requireFinancialAccess,
 *     withEffectiveStatus (no 'use server' -- plain helpers, not actions)
 *   - financial-sales-sync.ts: syncSaleRevenueEntry
 *   - financial-entries.ts: entry CRUD + AI category suggestion
 *   - financial-attachments.ts: entry attachment upload/delete/signed-URL
 *   - financial-summary.ts: dashboard summary, KPIs, cash-flow series,
 *     expense/revenue breakdown
 *   - financial-reports.ts: DRE, daily cash flow, due entries, projection
 *   - financial-dashboard.ts: accounts overview, strategic indicators,
 *     alerts, combined dashboard-data fetch
 * No 'use server' needed here -- it only re-exports async functions
 * defined in files that each carry their own 'use server'.
 */

export type { FinancialEntryRow } from './financial-shared'
export * from './financial-sales-sync'
export * from './financial-entries'
// financial-entries.ts can't re-export this itself (it has its own 'use
// server' for its local actions -- see the note above the other barrels).
export { suggestCategoryForEntry } from './financial-entries-ai'
export * from './financial-attachments'
export * from './financial-summary'
export * from './financial-reports'
export * from './financial-dashboard'
