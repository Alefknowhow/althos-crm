/**
 * Contrato de assinatura de plano (Agências de Tráfego) -- barrel. Tabela
 * própria (plan_contracts, migration 0194), NÃO compartilhada com
 * sale_contracts (Reservas/Viagens). Mesma estrutura/fluxo (Autentique),
 * copiada, não reaproveitada por referência — só a credencial de API
 * (getApiKeyOrFail) é compartilhada, por ser configuração da organização,
 * não dado de contrato.
 *
 * Split across two files (each carries its own 'use server'; this file
 * only re-exports, so it doesn't need one):
 *   - plan-contracts-render.ts: render data, editable body, save, read
 *   - plan-contracts-signature.ts: PDF upload, Autentique signature flow,
 *     file/link retrieval
 */

export * from './plan-contracts-render'
export * from './plan-contracts-signature'
