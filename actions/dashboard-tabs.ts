/**
 * Dashboard-tabs actions -- barrel. Split across seven files (each carries
 * its own 'use server' except dashboard-tabs-shared.ts; this file only
 * re-exports, so it doesn't need one):
 *   - dashboard-tabs-shared.ts: fetchCompletedSalesWithContact
 *   - dashboard-tabs-products.ts: ticket médio, top products, lead sources
 *   - dashboard-tabs-customers.ts: LTV, by city, VIP, at-risk
 *   - dashboard-tabs-recompra.ts: repurchase ranking, seller goals,
 *     repurchase rate, customer segmentation
 *   - dashboard-tabs-response.ts: AI response metrics, loss reasons
 *   - dashboard-tabs-sellers.ts: seller conversion/deals/score/monthly/
 *     comparison
 *   - dashboard-tabs-misc.ts: top destinations, NPS score
 */

export * from './dashboard-tabs-products'
export * from './dashboard-tabs-customers'
export * from './dashboard-tabs-recompra'
export * from './dashboard-tabs-response'
export * from './dashboard-tabs-sellers'
export * from './dashboard-tabs-misc'
