// =====================================================================
// Parentesco / vínculos entre contatos (contato_relationships).
// Constantes e tipos puros — separados das server actions para que o
// arquivo 'use server' exporte apenas funções async (exigência do Next).
// =====================================================================

export const RELATIONSHIP_KINDS = [
  'mae',
  'pai',
  'filho',
  'filha',
  'irmao',
  'irma',
  'conjuge',
  'avo',
  'ava',
  'neto',
  'neta',
  'tio',
  'tia',
  'primo',
  'prima',
  'responsavel',
  'dependente',
  'outro',
] as const

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number]

export const RELATIONSHIP_LABELS: Record<RelationshipKind, string> = {
  mae: 'Mãe',
  pai: 'Pai',
  filho: 'Filho',
  filha: 'Filha',
  irmao: 'Irmão',
  irma: 'Irmã',
  conjuge: 'Cônjuge',
  avo: 'Avô',
  ava: 'Avó',
  neto: 'Neto',
  neta: 'Neta',
  tio: 'Tio',
  tia: 'Tia',
  primo: 'Primo',
  prima: 'Prima',
  responsavel: 'Responsável',
  dependente: 'Dependente',
  outro: 'Outro',
}

export type RelationshipRow = {
  id: string
  kind: RelationshipKind
  note: string | null
  /** null quando é um vínculo "manual" (pessoa sem contato próprio no CRM). */
  related_contato_id: string | null
  related_name: string
  /** Só preenchidos no vínculo manual — no vínculo com contato existente,
   *  esses dados vivem no próprio contato relacionado. */
  related_cpf: string | null
  related_birth_date: string | null
  created_at: string
}
