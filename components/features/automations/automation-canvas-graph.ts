import type { Node, Edge } from '@xyflow/react'
import type { AutomationFlow, AutomationFlowEdge } from '@/lib/automations/automation-traversal'
import type { AutomationCanvasNodeData } from './AutomationFlowCanvasNode'
import { describeTrigger, describeStep, type Step, type FormOpt, type StageOpt } from './AutomationFlowMeta'

export const NODE_GAP_Y = 140

/** Monta o grafo inicial (nodes + edges) do canvas a partir de `auto.steps`
 *  (fonte de verdade dos passos) + `auto.flow` (posições/conexões salvas,
 *  ou uma cadeia linear trigger→passo1→...→end quando não há nada salvo
 *  ainda). Extraído de AutomationFlowCanvas.tsx só por tamanho de arquivo. */
export function buildInitialGraph(
  steps: Step[], auto: any, opts: { forms: FormOpt[]; stages: StageOpt[] },
): { nodes: Node<AutomationCanvasNodeData>[]; edges: Edge[] } {
  const { forms, stages } = opts
  const flow: AutomationFlow | undefined = auto.flow
  const ids = steps.map(s => s.id)
  const chain = ['trigger', ...ids, 'end']
  const positions = flow?.positions || {}

  const nodes: Node<AutomationCanvasNodeData>[] = chain.map((id, i) => {
    const step = ids.includes(id) ? steps[ids.indexOf(id)] : null
    const kind: AutomationCanvasNodeData['kind'] = id === 'trigger' ? 'trigger' : id === 'end' ? 'end' : 'step'
    const label = kind === 'trigger'
      ? describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages) || 'Qualquer disparo'
      : kind === 'step' && step ? describeStep(step, stages) || 'Sem configuração'
      : ''
    return {
      id,
      type: 'automation',
      position: positions[id] || { x: 40, y: i * NODE_GAP_Y },
      data: { kind, typeId: kind === 'trigger' ? auto.trigger_type : step?.type, label },
    }
  })

  const savedEdges = flow?.edges
  const sourceEdges: AutomationFlowEdge[] = savedEdges && savedEdges.length > 0
    ? savedEdges
    : chain.slice(0, -1).map((id, i) => ({ id: `${id}->${chain[i + 1]}`, from: id, to: chain[i + 1] }))

  const edges: Edge[] = sourceEdges.map(e => ({
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: 'default',
    animated: !e.condition,
    label: e.condition?.type === 'keyword' ? 'palavra-chave' : e.condition?.type === 'button' ? `botão ${e.condition.buttonIndex}` : undefined,
    data: { condition: e.condition },
  }))

  return { nodes, edges }
}

/** true quando o step é 'send_instagram_dm' — só pode existir num fluxo
 *  cujo gatilho seja de Instagram (regra de negócio pedida explicitamente:
 *  um disparo de Instagram só é aceito com um trigger de Instagram). */
export function isInstagramTrigger(triggerType: string): boolean {
  return triggerType === 'instagram.dm.received' || triggerType === 'instagram.comment.received'
}
