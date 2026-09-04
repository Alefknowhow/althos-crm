/**
 * Vertical Clínicas — Estoque de insumos (exclusivo do nicho) -- barrel.
 * Split across three files (each carries its own 'use server'; this file
 * only re-exports, so it doesn't need one):
 *   - clinic-estoque-supplies.ts: catálogo de insumos (CRUD, ajuste manual)
 *   - clinic-estoque-recipe.ts: receita por procedimento, baixa automática
 *     por atendimento, backlog de consumo
 *   - clinic-estoque-invoices.ts: notas fiscais (CRUD, importação de XML), KPIs
 *
 * Ver supabase/migrations/0211_clinic_estoque_foundation.sql.
 */

export * from './clinic-estoque-supplies'
export * from './clinic-estoque-recipe'
export * from './clinic-estoque-invoices'
