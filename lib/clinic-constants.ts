// Constantes puras da vertical Clínicas — sem 'use server' (importável de
// client components), separado de actions/clinic.ts porque um arquivo
// 'use server' só pode exportar funções async.

export const CLINIC_STATUSES = [
  'aguardando_confirmacao', 'agendado', 'confirmado', 'em_atendimento',
  'realizado', 'cancelado', 'reagendado', 'no_show',
] as const
export type ClinicStatus = (typeof CLINIC_STATUSES)[number]

export const CLINIC_STATUS_LABEL: Record<ClinicStatus, string> = {
  aguardando_confirmacao: 'Aguardando confirmação',
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  reagendado: 'Reagendado',
  no_show: 'Não compareceu',
}
