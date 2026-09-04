/**
 * Travel sales actions -- barrel. Split across six files (each carries its
 * own 'use server' except travel-sales-shared.ts; this file only
 * re-exports, so it doesn't need one):
 *   - travel-sales-shared.ts: TravelSaleRow/FlightSegment types, pick()
 *   - travel-sales-crud.ts: list/get/update/delete/cancel
 *   - travel-sales-contract.ts: contract lifecycle, traveler info
 *   - travel-sales-create.ts: manual creation + mapProposalToSaleFields
 *   - travel-sales-tasks.ts: save sale + generate tasks
 *   - travel-sales-won.ts: auto-create on lead won, suggested tasks
 */

export * from './travel-sales-shared'
export * from './travel-sales-crud'
export * from './travel-sales-contract'
export * from './travel-sales-create'
export * from './travel-sales-tasks'
export * from './travel-sales-won'
