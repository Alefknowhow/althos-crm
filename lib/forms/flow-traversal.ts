/**
 * Travessia do fluxo condicional de um formulário (modo uma-pergunta-por-
 * vez). `schema.flow` é opcional — um formulário sem ele (todo formulário
 * existente hoje) cai sempre no fallback de ordem linear, então esta
 * função reproduz exatamente o comportamento de antes quando não há
 * grafo desenhado. É a peça que faz o canvas (FormFlowCanvas.tsx) valer
 * de verdade: o renderizador público (OneQuestionForm.tsx) chama
 * literalmente esta função pra decidir a próxima pergunta — não é um
 * desenho cosmético por cima de um array linear (ver histórico de
 * components/features/automations/AutomationFlow.tsx, que caiu nessa
 * armadilha).
 */

export type FlowOperator = 'eq' | 'neq' | 'contains' | 'not_contains' | 'is_empty' | 'is_filled'

export type FlowCondition = {
  fieldId: string
  operator: FlowOperator
  value?: string
}

export type FlowEdge = {
  id: string
  /** 'welcome' | id de um field */
  from: string
  /** id de um field | 'ending' */
  to: string
  /** Ausente = "caminho padrão" (usado quando nenhuma condição bate). */
  condition?: FlowCondition
}

export type FormFlow = {
  edges: FlowEdge[]
  positions?: Record<string, { x: number; y: number }>
}

function toComparable(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

export function evaluateCondition(condition: FlowCondition, answers: Record<string, any>): boolean {
  const raw = answers[condition.fieldId]
  const current = toComparable(raw).trim().toLowerCase()
  const target = (condition.value || '').trim().toLowerCase()

  switch (condition.operator) {
    case 'eq': return current === target
    case 'neq': return current !== target
    case 'contains': return current.includes(target)
    case 'not_contains': return !current.includes(target)
    case 'is_empty': return current === ''
    case 'is_filled': return current !== ''
    default: return false
  }
}

/**
 * Resolve o próximo node ('ending' incluso) a partir de `fromId`, dadas as
 * respostas já coletadas. Sem edges saindo de `fromId`, cai no
 * `fallbackOrder` (a ordem linear de sempre — ver lib/forms/field-order.ts).
 */
export function getNextNodeId(
  flow: FormFlow | undefined,
  fromId: string,
  answers: Record<string, any>,
  fallbackOrder: string[],
): string {
  const outgoing = flow?.edges?.filter(e => e.from === fromId) ?? []

  if (outgoing.length > 0) {
    const matched = outgoing.find(e => e.condition && evaluateCondition(e.condition, answers))
    if (matched) return matched.to
    const defaultEdge = outgoing.find(e => !e.condition)
    if (defaultEdge) return defaultEdge.to
    // Só existem edges condicionais aqui e nenhuma bateu — beco sem saída,
    // trata como fim do formulário (sem bloquear o envio).
    return 'ending'
  }

  const idx = fallbackOrder.indexOf(fromId)
  if (idx === -1 || idx === fallbackOrder.length - 1) return 'ending'
  return fallbackOrder[idx + 1]
}
