/**
 * Condições genéricas AND/OR sobre campos do CRM (issue #18, seções 6/7) —
 * usadas pelo step de automação "Condição (SE)". Allowlist explícita de
 * campos de `contatos` (nunca um campo arbitrário/SQL livre), com operadores
 * compatíveis com o tipo de cada campo.
 *
 * Forma suportada — grupos combinados por OU, regras dentro de um grupo
 * combinadas por E (equivalente a "forma normal disjuntiva", cobre o
 * exemplo da issue: "Destino = Internacional E (Seguro = Ausente OU
 * Seguro = Pendente)" já vira 2 grupos: [Destino=Internacional E
 * Seguro=Ausente] OU [Destino=Internacional E Seguro=Pendente]).
 */

export type ConditionFieldType = 'text' | 'select' | 'number' | 'tags' | 'stage'

export type ConditionOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'gt' | 'lt' | 'is_empty' | 'not_empty'

export type ConditionFieldMeta = {
  key: string
  label: string
  type: ConditionFieldType
  options?: { value: string; label: string }[]
}

export const CONDITION_FIELDS: ConditionFieldMeta[] = [
  { key: 'stage_id', label: 'Estágio', type: 'stage' },
  { key: 'tags', label: 'Tag', type: 'tags' },
  { key: 'value_cents', label: 'Valor do negócio (R$)', type: 'number' },
  { key: 'status', label: 'Status do contato', type: 'select', options: [
    { value: 'lead', label: 'Lead' },
    { value: 'cliente', label: 'Cliente' },
  ] },
  { key: 'deal_status', label: 'Status do negócio', type: 'select', options: [
    { value: 'aberto', label: 'Aberto' },
    { value: 'ganho', label: 'Ganho' },
    { value: 'perdido', label: 'Perdido' },
    { value: 'desqualificado', label: 'Desqualificado' },
  ] },
  { key: 'ai_tier', label: 'Tier de IA', type: 'select', options: [
    { value: 'quente', label: 'Quente' },
    { value: 'morno', label: 'Morno' },
    { value: 'frio', label: 'Frio' },
  ] },
  { key: 'assigned_to', label: 'Responsável (ID do membro)', type: 'text' },
  { key: 'source', label: 'Origem', type: 'text' },
]

export const OPERATORS_BY_TYPE: Record<ConditionFieldType, { value: ConditionOperator; label: string }[]> = {
  text:   [{ value: 'equals', label: 'é' }, { value: 'not_equals', label: 'não é' }, { value: 'contains', label: 'contém' }, { value: 'is_empty', label: 'está vazio' }, { value: 'not_empty', label: 'não está vazio' }],
  select: [{ value: 'equals', label: 'é' }, { value: 'not_equals', label: 'não é' }, { value: 'is_empty', label: 'está vazio' }, { value: 'not_empty', label: 'não está vazio' }],
  stage:  [{ value: 'equals', label: 'é' }, { value: 'not_equals', label: 'não é' }],
  number: [{ value: 'equals', label: '=' }, { value: 'gt', label: '>' }, { value: 'lt', label: '<' }, { value: 'is_empty', label: 'está vazio' }, { value: 'not_empty', label: 'não está vazio' }],
  tags:   [{ value: 'contains', label: 'contém' }, { value: 'not_contains', label: 'não contém' }],
}

export function conditionFieldMeta(key: string): ConditionFieldMeta | undefined {
  return CONDITION_FIELDS.find(f => f.key === key)
}

export type ConditionRule = { field: string; operator: ConditionOperator; value?: string }
export type ConditionGroup = { rules: ConditionRule[] }
export type ConditionStepConfig = { groups: ConditionGroup[] }

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (Array.isArray(v)) return v.length === 0
  return String(v).trim() === ''
}

/** Avalia UMA regra contra o registro (lead/contato). Puro — sem I/O. */
export function evaluateConditionRule(rule: ConditionRule, record: Record<string, any>): boolean {
  const raw = record?.[rule.field]
  switch (rule.operator) {
    case 'is_empty':     return isEmptyValue(raw)
    case 'not_empty':    return !isEmptyValue(raw)
    case 'gt':            return Number(raw ?? 0) > Number(rule.value ?? 0)
    case 'lt':            return Number(raw ?? 0) < Number(rule.value ?? 0)
    case 'contains':
      if (Array.isArray(raw)) return raw.some(v => String(v).toLowerCase() === String(rule.value ?? '').toLowerCase())
      return String(raw ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase())
    case 'not_contains':
      if (Array.isArray(raw)) return !raw.some(v => String(v).toLowerCase() === String(rule.value ?? '').toLowerCase())
      return !String(raw ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase())
    case 'not_equals':   return String(raw ?? '') !== String(rule.value ?? '')
    case 'equals':
    default:              return String(raw ?? '') === String(rule.value ?? '')
  }
}

/** Grupos vazios = sempre passa (condição "sem filtro"). Grupos combinados
 *  por OU; regras dentro de um grupo combinadas por E. */
export function evaluateConditionGroups(groups: ConditionGroup[] | undefined, record: Record<string, any>): boolean {
  if (!groups || groups.length === 0) return true
  return groups.some(g => (g.rules || []).every(r => evaluateConditionRule(r, record)))
}
