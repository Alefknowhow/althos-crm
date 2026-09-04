/**
 * Quotations actions -- barrel. Split across four files (each carries its
 * own 'use server'; this file only re-exports, so it doesn't need one):
 *   - quotations-core.ts: schemas, getQuotationFull/getQuotationProductsSummary,
 *     saveQuotation
 *   - quotations-footer.ts: saved footer/identity profiles (2nd-agency brand)
 *   - quotations-offers.ts: public link, offers CRUD, offer<->quotation
 *     conversion, sale creation from a quotation
 *   - quotations-external.ts: TripAdvisor + Unsplash lookups
 */

export * from './quotations-core'
export * from './quotations-footer'
export * from './quotations-offers'
export * from './quotations-external'
