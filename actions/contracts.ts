/**
 * Sale contract (Reservas/Viagens) -- barrel. Split across two files
 * (each carries its own 'use server'; this file only re-exports, so it
 * doesn't need one):
 *   - contracts-render.ts: requireAccess, getContractRenderData,
 *     Autentique API-key config, getSaleContract
 *   - contracts-signature.ts: PDF upload, Autentique signature flow,
 *     file/link retrieval
 */

export * from './contracts-render'
export * from './contracts-signature'
