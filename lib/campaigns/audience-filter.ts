/**
 * Tipo + valor default do filtro de público das Campanhas de Envio.
 * Módulo comum (sem 'use server') porque um arquivo 'use server' só pode
 * exportar funções async — EMPTY_AUDIENCE_FILTER é um objeto, não pode
 * viver em actions/send-campaigns-audience.ts.
 */

export interface AudienceFilter {
  tags: string[]
  stageIds: string[]
  pipelineId: string | null
  // Mesmas dimensões já usadas na lista de Contatos
  // (app/app/[orgSlug]/contatos/page.tsx) — status/origem como array
  // (multi-seleção, "lead" E "cliente" ao mesmo tempo, por ex.).
  status: string[]
  sources: string[]
  tier: string
  hasEmail: boolean
  hasPhone: boolean
  noContactDays: number
  createdFrom: string
  createdTo: string
  valueMin: number
  valueMax: number
}

export const EMPTY_AUDIENCE_FILTER: AudienceFilter = {
  tags: [], stageIds: [], pipelineId: null, status: [], sources: [], tier: '',
  hasEmail: false, hasPhone: false, noContactDays: 0, createdFrom: '', createdTo: '',
  valueMin: 0, valueMax: 0,
}
