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
  related_contato_id: string
  related_name: string
  created_at: string
}
