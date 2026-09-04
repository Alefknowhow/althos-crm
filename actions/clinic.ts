/**
 * Vertical Clínicas — Fase 1 (fundação) -- barrel. Split across three
 * files (each carries its own 'use server'; this file only re-exports,
 * so it doesn't need one):
 *   - clinic-directory.ts: especialidades, profissionais, salas
 *   - clinic-service-context.ts: contexto clínico do serviço (event_types)
 *     e do agendamento (appointments)
 *   - clinic-appointment-status.ts: máquina de estados do agendamento,
 *     lembrete automático (24h antes)
 *
 * Ver supabase/migrations/0164_clinic_vertical_foundation.sql.
 */

export * from './clinic-directory'
export * from './clinic-service-context'
export * from './clinic-appointment-status'
