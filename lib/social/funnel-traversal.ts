/**
 * Travessia do fluxo condicional de um funil de DM do Instagram — mesmo
 * desenho de lib/forms/flow-traversal.ts (o mesmo problema, "grafo real
 * lido pelo motor, não um desenho cosmético" — ver histórico de
 * components/features/automations/AutomationFlow.tsx). `funnel.flow` é
 * opcional; sem ele, cai sempre no fallback linear de sort_order — um
 * funil existente não muda de comportamento.
 *
 * Ramificação só se aplica no ponto onde já existe uma resposta real pra
 * decidir (um passo com wait_for_reply que acabou de ser respondido) —
 * passos sem espera continuam disparando em sequência, sem decisão.
 */

export type FunnelEdgeCondition =
  | { type: 'button'; buttonIndex: number }
  | { type: 'keyword'; operator: 'eq' | 'contains'; value: string }

export type FunnelFlowEdge = {
  id: string
  /** 'trigger' | client_id de um passo */
  from: string
  /** client_id de um passo | 'end' */
  to: string
  /** Ausente = "caminho padrão" (usado quando nenhuma condição bate). */
  condition?: FunnelEdgeCondition
}

export type FunnelFlow = {
  edges: FunnelFlowEdge[]
  positions?: Record<string, { x: number; y: number }>
}

function evaluateCondition(condition: FunnelEdgeCondition, replyText: string, matchedButtonIndex: number | null): boolean {
  if (condition.type === 'button') return matchedButtonIndex === condition.buttonIndex
  const current = replyText.trim().toLowerCase()
  const target = condition.value.trim().toLowerCase()
  return condition.operator === 'eq' ? current === target : current.includes(target)
}

export type StepReply = {
  replyText: string
  matchedButtonIndex: number | null
  fallbackOrder: string[]
}

/**
 * Resolve o próximo node ('end' incluso) a partir de `fromId`. Sem edges
 * saindo de `fromId`, cai no `fallbackOrder` (sort_order de sempre).
 */
export function getNextStepId(flow: FunnelFlow | undefined, fromId: string, reply: StepReply): string {
  const { replyText, matchedButtonIndex, fallbackOrder } = reply
  const outgoing = flow?.edges?.filter(e => e.from === fromId) ?? []

  if (outgoing.length > 0) {
    const matched = outgoing.find(e => e.condition && evaluateCondition(e.condition, replyText, matchedButtonIndex))
    if (matched) return matched.to
    const defaultEdge = outgoing.find(e => !e.condition)
    if (defaultEdge) return defaultEdge.to
    // Só existem edges condicionais e nenhuma bateu — trata como fim, não
    // trava a conversa num beco sem saída silencioso.
    return 'end'
  }

  const idx = fallbackOrder.indexOf(fromId)
  if (idx === -1 || idx === fallbackOrder.length - 1) return 'end'
  return fallbackOrder[idx + 1]
}
