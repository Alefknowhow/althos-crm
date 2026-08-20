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

export const CLINIC_QUOTE_STATUSES = [
  'rascunho', 'enviado', 'visualizado', 'aprovado', 'recusado', 'expirado', 'cancelado',
] as const
export type ClinicQuoteStatus = (typeof CLINIC_QUOTE_STATUSES)[number]

export const CLINIC_TREATMENT_STATUSES = [
  'planejado', 'em_andamento', 'concluido', 'pausado', 'cancelado',
] as const
export type ClinicTreatmentStatus = (typeof CLINIC_TREATMENT_STATUSES)[number]

export const CLINIC_TREATMENT_STATUS_LABEL: Record<ClinicTreatmentStatus, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
}

export const CLINIC_PACKAGE_STATUSES = ['ativo', 'utilizado', 'expirado', 'cancelado'] as const
export type ClinicPackageStatus = (typeof CLINIC_PACKAGE_STATUSES)[number]

export const CLINIC_PACKAGE_STATUS_LABEL: Record<ClinicPackageStatus, string> = {
  ativo: 'Ativo',
  utilizado: 'Utilizado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
}

export const CLINIC_WAITLIST_STATUSES = ['aguardando', 'contatado', 'agendado', 'cancelado'] as const
export type ClinicWaitlistStatus = (typeof CLINIC_WAITLIST_STATUSES)[number]

export const CLINIC_WAITLIST_STATUS_LABEL: Record<ClinicWaitlistStatus, string> = {
  aguardando: 'Aguardando',
  contatado: 'Contatado',
  agendado: 'Agendado',
  cancelado: 'Cancelado',
}

export const CLINIC_COMMISSION_STATUSES = ['pendente', 'pago'] as const
export type ClinicCommissionStatus = (typeof CLINIC_COMMISSION_STATUSES)[number]

export const CLINIC_COMMISSION_SOURCE_TYPES = ['orcamento', 'atendimento', 'pacote', 'manual'] as const
export type ClinicCommissionSourceType = (typeof CLINIC_COMMISSION_SOURCE_TYPES)[number]

export const CLINIC_COMMISSION_SOURCE_LABEL: Record<ClinicCommissionSourceType, string> = {
  orcamento: 'Orçamento aprovado',
  atendimento: 'Atendimento',
  pacote: 'Pacote',
  manual: 'Manual',
}
