/**
 * Appointments actions -- barrel. Split across four files (each carries its
 * own 'use server'; this file only re-exports, so it doesn't need one):
 *   - appointments-event-types.ts: event type CRUD
 *   - appointments-availability.ts: weekly recurring availability +
 *     appointment list/cancel/complete
 *   - appointments-manual.ts: admin-created (manual) booking
 *   - appointments-public.ts: public/anonymous booking flow
 */

export * from './appointments-event-types'
export * from './appointments-availability'
export * from './appointments-manual'
export * from './appointments-public'
