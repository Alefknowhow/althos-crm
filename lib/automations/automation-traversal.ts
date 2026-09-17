/**
 * Travessia do fluxo condicional de uma automação genérica — mesmo desenho
 * de lib/social/funnel-traversal.ts (o mesmo problema, "grafo real lido
 * pelo motor, não um desenho cosmético" — ver histórico de
 * components/features/automations/AutomationFlow.tsx). `automation.flow` é
 * opcional; sem ele, o motor (lib/inngest/automation.ts) cai no array
 * linear de `steps` de sempre — uma automação existente não muda de
 * comportamento.
 *
 * Ramificação só se aplica no ponto onde já existe uma resposta real pra
 * decidir (um passo `wait_for_reply` que acabou de ser respondido) —
 * passos sem espera continuam disparando em sequência, sem decisão.
 */

export type AutomationEdgeCondition =
  | { type: 'button'; buttonIndex: number }
  | { type: 'keyword'; operator: 'eq' | 'contains'; value: string }

export type AutomationFlowEdge = {
  id: string
  /** 'trigger' | id de um step (Step.id) */
  from: string
  /** id de um step | 'end' */
  to: string
  /** Ausente = "caminho padrão" (usado quando nenhuma condição bate). */
  condition?: AutomationEdgeCondition
}

export type AutomationFlow = {
  edges: AutomationFlowEdge[]
  positions?: Record<string, { x: number; y: number }>
}

function evaluateCondition(condition: AutomationEdgeCondition, replyText: string, matchedButtonIndex: number | null): boolean {
  if (condition.type === 'button') return matchedButtonIndex === condition.buttonIndex
  const current = replyText.trim().toLowerCase()
  const target = condition.value.trim().toLowerCase()
  return condition.operator === 'eq' ? current === target : current.includes(target)
}

export type AutomationStepReply = {
  replyText: string
  matchedButtonIndex: number | null
  fallbackOrder: string[]
}

/**
 * Resolve o próximo step id ('end' incluso) a partir de `fromId`. Sem edges
 * saindo de `fromId`, cai no `fallbackOrder` (ordem do array `steps`).
 */
export function getNextAutomationStepId(flow: AutomationFlow | undefined, fromId: string, reply: AutomationStepReply): string {
  const { replyText, matchedButtonIndex, fallbackOrder } = reply
  const outgoing = flow?.edges?.filter(e => e.from === fromId) ?? []

  if (outgoing.length > 0) {
    const matched = outgoing.find(e => e.condition && evaluateCondition(e.condition, replyText, matchedButtonIndex))
    if (matched) return matched.to
    const defaultEdge = outgoing.find(e => !e.condition)
    if (defaultEdge) return defaultEdge.to
    // Só existem edges condicionais e nenhuma bateu — trata como fim, não
    // trava o run à espera de uma resposta que nunca vai casar.
    return 'end'
  }

  const idx = fallbackOrder.indexOf(fromId)
  if (idx === -1 || idx === fallbackOrder.length - 1) return 'end'
  return fallbackOrder[idx + 1]
}

/** Primeiro step a executar quando o run começa — edge saindo de 'trigger'
 *  se o flow definir uma explicitamente, senão o primeiro do array (ordem
 *  de sempre). */
export function getFirstAutomationStepId(flow: AutomationFlow | undefined, fallbackOrder: string[]): string | null {
  const fromTrigger = flow?.edges?.find(e => e.from === 'trigger' && !e.condition)
  if (fromTrigger) return fromTrigger.to
  return fallbackOrder[0] ?? null
}
