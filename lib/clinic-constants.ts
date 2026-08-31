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

/**
 * Cor por ESTÁGIO do agendamento (não por procedimento) — usada na agenda
 * diária por profissional. Agrupa os 8 status granulares em 4 estágios
 * visuais (o que importa pra quem olha a agenda de relance é "chegou?
 * está sendo atendido? já terminou? foi cancelado?", não o status exato).
 * O nome do procedimento continua identificado por texto dentro do card.
 */
export const CLINIC_STATUS_COLOR: Record<ClinicStatus, string> = {
  aguardando_confirmacao: '#94a3b8', // cinza — ainda nem confirmado
  agendado: '#3b82f6',               // azul — agendado, ainda não chegou
  confirmado: '#3b82f6',             // azul — confirmado, ainda não chegou
  reagendado: '#3b82f6',             // azul — reagendado, ainda não chegou
  em_atendimento: '#f59e0b',         // âmbar — em atendimento agora
  realizado: '#10b981',              // verde — atendimento finalizado
  cancelado: '#ef4444',              // vermelho — cancelado
  no_show: '#ef4444',                // vermelho — não compareceu
}

/** Legenda (estágio → cor + rótulo curto) pra exibir na agenda. */
export const CLINIC_STAGE_LEGEND: { color: string; label: string }[] = [
  { color: '#3b82f6', label: 'Não chegou' },
  { color: '#f59e0b', label: 'Em atendimento' },
  { color: '#10b981', label: 'Finalizado' },
  { color: '#ef4444', label: 'Cancelado / faltou' },
]

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
